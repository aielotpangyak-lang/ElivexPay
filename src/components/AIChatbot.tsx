import { useState, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { XCircle, Send, Loader2, Bot, User, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import Markdown from 'react-markdown';

const US_UK_NAMES = [
  "James Smith", "Michael Johnson", "Robert Williams", "David Brown", "Richard Jones", "Joseph Garcia", "Thomas Miller", "Charles Davis", "Christopher Rodriguez", "Daniel Martinez",
  "Matthew Hernandez", "Anthony Lopez", "Mark Gonzalez", "Donald Wilson", "Steven Anderson", "Paul Thomas", "Andrew Taylor", "Joshua Moore", "Kenneth Jackson", "Kevin Martin",
  "Brian Lee", "George Perez", "Edward Thompson", "Ronald White", "Timothy Harris", "Jason Sanchez", "Jeffrey Clark", "Ryan Ramirez", "Jacob Lewis", "Gary Robinson",
  "Nicholas Walker", "Eric Young", "Jonathan Allen", "Stephen King", "Larry Wright", "Justin Scott", "Scott Torres", "Brandon Nguyen", "Benjamin Hill", "Samuel Flores",
  "Gregory Green", "Alexander Adams", "Frank Nelson", "Patrick Baker", "Raymond Hall", "Jack Rivera", "Dennis Campbell", "Jerry Mitchell", "Tyler Carter", "Aaron Roberts",
  "Jose Gomez", "Adam Phillips", "Nathan Evans", "Henry Turner", "Douglas Diaz", "Zachary Parker", "Peter Cruz", "Kyle Edwards", "Walter Collins", "Harold Reyes",
  "Jeremy Stewart", "Ethan Morris", "Carl Morales", "Keith Murphy", "Roger Cook", "Gerald Rogers", "Christian Morgan", "Terry Peterson", "Sean Cooper", "Arthur Reed",
  "Austin Bailey", "Noah Bell", "Jesse Gomez", "Joe Kelly", "Bryan Howard", "Billy Ward", "Jordan Cox", "Albert Diaz", "Dylan Richardson", "Willie Wood",
  "Alan Watson", "Juan Brooks", "Logan Bennett", "Wayne Gray", "Ralph James", "Roy Reyes", "Eugene Cruz", "Gabriel Hughes", "Louis Price", "Russell Myers",
  "Mary Smith", "Patricia Johnson", "Jennifer Williams", "Linda Brown", "Elizabeth Jones", "Barbara Garcia", "Susan Miller", "Jessica Davis", "Sarah Rodriguez", "Karen Martinez",
  "Nancy Hernandez", "Lisa Lopez", "Betty Gonzalez", "Margaret Wilson", "Sandra Anderson", "Ashley Thomas", "Dorothy Taylor", "Kimberly Moore", "Emily Jackson", "Donna Martin",
  "Michelle Lee", "Carol Perez", "Amanda Thompson", "Melissa White", "Deborah Harris", "Stephanie Sanchez", "Rebecca Clark", "Laura Ramirez", "Sharon Lewis", "Cynthia Robinson",
  "Kathleen Walker", "Amy Young", "Shirley Allen", "Angela King", "Helen Wright", "Anna Scott", "Brenda Torres", "Pamela Nguyen", "Nicole Hill", "Samantha Flores",
  "Katherine Green", "Emma Adams", "Ruth Nelson", "Christine Baker", "Catherine Hall", "Debra Rivera", "Virginia Campbell", "Rachel Mitchell", "Carolyn Carter", "Janet Roberts",
  "Maria Gomez", "Heather Phillips", "Diane Evans", "Julie Turner", "Joyce Diaz", "Victoria Parker", "Kelly Cruz", "Christina Edwards", "Joan Collins", "Evelyn Reyes"
];

interface Message {
  role: 'user' | 'bot';
  text: string;
}

export default function AIChatbot({ onClose, onComplete }: { onClose: () => void, onComplete: () => void }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: 'bot', text: 'Hello! I can help you generate 100 orders. What is the order size range (e.g., 300-10,000)?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<Message[][]>([]);

  const SYSTEM_PROMPT = `You are an AI assistant helping an admin generate 100 orders at once.
        CRITICAL: You MUST collect all necessary payment information. Orders without payment info will be marked as "Pending Info" which is NOT desired.
        
        Follow this exact flow:
        1. Ask for order size range (e.g., 300-10,000).
        2. Ask if they want random amounts with hundreds (e.g., 458) or only hundreds (e.g., 500, 600).
        3. Ask for the number of UPI IDs to divide into.
        4. Ask for the UPI IDs one by one.
        5. Ask for the number of bank accounts to receive money into.
        6. Ask for the bank account details (Bank Name, Account Number, IFSC) one by one.
        
        CRITICAL: Do not stop until you have at least one UPI ID or one Bank Account.
        If the user says "done" or "generate" but hasn't provided any payment details, WARN them that this will create "Pending Info" orders and ask for details again.
        
        Once you have ALL information, output a JSON object with all the details.
        The JSON must look like this:
        {
          "orderSizeRange": "300-10000",
          "amountType": "random",
          "upiIds": ["upi1@okaxis", "upi2@okaxis"],
          "bankAccounts": [
            {"bankName": "HDFC", "bankAccNo": "123456", "bankIfsc": "HDFC0001"}
          ],
          "payeeNames": ["James Smith", "Mary Johnson", ...]
        }
        
        I will provide a list of 150 US/UK names for you to use in the "payeeNames" array. Use as many as possible to ensure variety.`;

  useEffect(() => {
    const savedMessages = localStorage.getItem('ai_chat_history');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
    const savedSessions = localStorage.getItem('ai_chat_sessions');
    if (savedSessions) {
      setChatSessions(JSON.parse(savedSessions));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    return () => {
      saveCurrentSession();
    };
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('ai_chat_sessions', JSON.stringify(chatSessions));
  }, [chatSessions]);

  const saveCurrentSession = () => {
    const newSessions = [messages, ...chatSessions].slice(0, 10);
    setChatSessions(newSessions);
  };

  const clearHistory = () => {
    saveCurrentSession();
    localStorage.removeItem('ai_chat_history');
    const initialMessages: Message[] = [{ role: 'bot', text: 'Hello! I can help you generate 100 orders. What is the order size range (e.g., 300-10,000)?' }];
    setMessages(initialMessages);
    initChat();
  };

  const loadSession = (session: Message[]) => {
    setMessages(session);
    setShowHistory(false);
  };

  const initChat = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('Gemini API Key is missing.');
      return null;
    }
    const ai = new GoogleGenAI({ apiKey });
    const newChat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_PROMPT + "\n\nNames to use:\n" + US_UK_NAMES.join(", "),
      },
    });
    setChat(newChat);
    return newChat;
  };

  useEffect(() => {
    const savedMessages = localStorage.getItem('ai_chat_history');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
    const savedSessions = localStorage.getItem('ai_chat_sessions');
    if (savedSessions) {
      setChatSessions(JSON.parse(savedSessions));
    }
    initChat();
  }, []);

  const handleSend = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      toast.error('Gemini API Key is missing. Please set GEMINI_API_KEY in your environment variables.');
      console.error('Gemini API Key is missing.');
      return;
    }

    let currentChat = chat;
    if (!currentChat) {
      currentChat = initChat();
    }
    if (!input.trim()) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const response = await currentChat.sendMessage({ message: userMessage });
      const botResponse = response.text || '';
      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);

      // Check if the bot is done and provided the JSON
      if (botResponse.includes('{') && botResponse.includes('}')) {
        const jsonMatch = botResponse.match(/\{.*\}/s);
        if (jsonMatch) {
          try {
            const orderData = JSON.parse(jsonMatch[0]);
            await generateOrders(orderData);
            onComplete();
          } catch (e) {
            console.error('JSON parse error:', e);
            toast.error('Failed to parse order data from AI');
          }
        }
      }
    } catch (error) {
      console.error('Chat error details:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('API_KEY_INVALID')) {
        toast.error('Invalid API Key. Please check your GEMINI_API_KEY.');
      } else if (errorMessage.includes('SAFETY')) {
        toast.error('Response blocked by safety filters.');
      } else {
        toast.error('Failed to get response from AI. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateOrders = async (data: any) => {
    setLoading(true);
    try {
      const orders = [];
      for (let i = 0; i < 100; i++) {
        const price = generateRandomPrice(data.orderSizeRange, data.amountType);
        const reward = Number((price * 0.045).toFixed(2));
        const itoken = Number((price + reward).toFixed(2));
        const orderNo = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
        
        const availableTypes = [];
        if (data.upiIds && data.upiIds.length > 0) availableTypes.push('UPI');
        if (data.bankAccounts && data.bankAccounts.length > 0) availableTypes.push('Bank');

        let type: 'UPI' | 'Bank' = 'UPI';
        let status: 'Available' | 'Pending Info' = 'Available';

        if (availableTypes.length > 0) {
          type = availableTypes[Math.floor(Math.random() * availableTypes.length)] as 'UPI' | 'Bank';
        } else {
          // If no payment info provided, we mark as Pending Info
          status = 'Pending Info';
        }

        const orderData: any = {
          price,
          reward,
          itoken,
          orderNo,
          type,
          status,
          createdAt: new Date().toISOString(),
          payeeName: data.payeeNames && data.payeeNames.length > 0 
            ? data.payeeNames[Math.floor(Math.random() * data.payeeNames.length)] 
            : US_UK_NAMES[Math.floor(Math.random() * US_UK_NAMES.length)]
        };

        if (status === 'Available') {
          if (type === 'UPI') {
            orderData.upiId = data.upiIds[Math.floor(Math.random() * data.upiIds.length)];
          } else {
            const bank = data.bankAccounts[Math.floor(Math.random() * data.bankAccounts.length)];
            orderData.bankName = bank.bankName;
            orderData.bankAccNo = bank.bankAccNo;
            orderData.bankIfsc = bank.bankIfsc;
          }
        }
        orders.push(orderData);
      }

      const batch = writeBatch(db);
      for (const order of orders) {
        const orderRef = doc(collection(db, 'buy_orders'));
        batch.set(orderRef, order);
      }
      await batch.commit();
      toast.success('100 orders generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate orders');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPrice = (range: any, type: 'random' | 'hundreds') => {
    let min = 300;
    let max = 10000;

    if (typeof range === 'string') {
      const parts = range.split('-').map(p => parseInt(p.replace(/,/g, '')));
      if (parts.length === 2) {
        min = parts[0];
        max = parts[1];
      }
    } else if (Array.isArray(range) && range.length === 2) {
      [min, max] = range;
    }

    let price = Math.floor(Math.random() * (max - min + 1)) + min;
    if (type === 'hundreds') {
      price = Math.floor(price / 100) * 100;
    }
    return price;
  };

  return (
    <div className="flex flex-col h-full bg-white p-6 relative">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)}><MoreVertical className="w-5 h-5 text-slate-600" /></button>
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Bot className="w-5 h-5 text-emerald-600" /> AI Order Generator</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearHistory} className="text-xs text-rose-500 font-bold hover:underline">Clear</button>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-slate-400" /></button>
        </div>
      </div>
      
      {showHistory && (
        <div className="absolute top-16 left-6 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-2 overflow-y-auto max-h-[calc(100%-100px)]">
          {chatSessions.map((session, i) => (
            <button 
              key={i} 
              onClick={() => loadSession(session)}
              className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Chat {chatSessions.length - i}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <Markdown>{msg.text}</Markdown>
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-500 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> AI is thinking...</div>}
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-sm"
          placeholder="Type your answer..."
        />
        <button onClick={handleSend} className="bg-indigo-600 text-white p-3 rounded-xl"><Send className="w-5 h-5" /></button>
      </div>
    </div>
  );
}
