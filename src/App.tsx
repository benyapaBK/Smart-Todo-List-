/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, Component, ReactNode } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  OperationType,
  handleFirestoreError
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  LogOut, 
  LogIn, 
  Loader2,
  AlertCircle,
  Check,
  Edit2,
  Save,
  X,
  Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Priority = 'low' | 'medium' | 'high';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  userId: string;
  createdAt: number;
}

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        errorMessage = `Error: ${parsed.error} (Operation: ${parsed.operationType})`;
      } catch {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Application Error</h2>
            <p className="text-zinc-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) {
      setTodos([]);
      return;
    }

    const q = query(
      collection(db, 'todos'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Todo[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Todo);
      });
      
      // Sort: Priority (High > Medium > Low) then Date (Newest first)
      const priorityMap = { high: 0, medium: 1, low: 2 };
      items.sort((a, b) => {
        if (priorityMap[a.priority] !== priorityMap[b.priority]) {
          return priorityMap[a.priority] - priorityMap[b.priority];
        }
        return b.createdAt - a.createdAt;
      });
      
      setTodos(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'todos');
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim() || !user || isAdding) return;

    setIsAdding(true);
    const todoId = crypto.randomUUID();
    const todoData: Todo = {
      id: todoId,
      text: newTodo.trim(),
      completed: false,
      priority: newPriority,
      userId: user.uid,
      createdAt: Date.now(),
    };

    try {
      await setDoc(doc(db, 'todos', todoId), todoData);
      setNewTodo('');
      setNewPriority('medium');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `todos/${todoId}`);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    try {
      await updateDoc(doc(db, 'todos', todo.id), {
        completed: !todo.completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `todos/${todo.id}`);
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    setEditPriority(todo.priority);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    try {
      await updateDoc(doc(db, 'todos', id), {
        text: editText.trim(),
        priority: editPriority
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `todos/${id}`);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `todos/${id}`);
    }
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'high': return 'text-rose-500 bg-rose-50 border-rose-100';
      case 'medium': return 'text-amber-500 bg-amber-50 border-amber-100';
      case 'low': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-zinc-100 p-10 text-center"
        >
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Smart Todo</h1>
          <p className="text-zinc-500 mb-8">Organize your life with real-time sync across all your devices.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-900 text-white rounded-2xl font-semibold hover:bg-zinc-800 transition-all active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Smart Todo</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 pr-4 border-r border-zinc-100">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt={user.displayName || 'User'} 
                className="w-8 h-8 rounded-full border border-zinc-200"
                referrerPolicy="no-referrer"
              />
              <span className="text-sm font-medium text-zinc-700 hidden sm:block">
                {user.displayName?.split(' ')[0]}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Input Area */}
        <div className="mb-12">
          <form onSubmit={addTodo} className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-2 flex flex-col gap-2">
            <div className="relative flex items-center">
              <input 
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-6 py-4 bg-transparent focus:outline-none text-lg placeholder:text-zinc-300"
              />
              <button 
                type="submit"
                disabled={!newTodo.trim() || isAdding}
                className="mr-2 w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-300 transition-all active:scale-90"
              >
                {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
              </button>
            </div>
            <div className="px-4 pb-2 flex items-center gap-4 border-t border-zinc-50 pt-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Priority:</span>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize",
                      newPriority === p 
                        ? getPriorityColor(p)
                        : "text-zinc-400 bg-zinc-50 border-zinc-100 hover:border-zinc-200"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Tasks ({todos.length})
          </h2>
          <div className="text-sm text-zinc-400">
            {todos.filter(t => t.completed).length} of {todos.length} completed
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {todos.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200"
              >
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-zinc-400">No tasks yet. Add one above!</p>
              </motion.div>
            ) : (
              todos.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "group flex flex-col gap-2 p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm transition-all hover:border-zinc-200",
                    todo.completed && "bg-zinc-50/50 opacity-75"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleTodo(todo)}
                      className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0",
                        todo.completed ? "bg-emerald-500 text-white" : "border-2 border-zinc-200 text-transparent hover:border-zinc-400"
                      )}
                    >
                      {todo.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </button>
                    
                    {editingId === todo.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <input 
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-zinc-400"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                              <button
                                key={p}
                                onClick={() => setEditPriority(p)}
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all capitalize",
                                  editPriority === p 
                                    ? getPriorityColor(p)
                                    : "text-zinc-400 bg-zinc-50 border-zinc-100"
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => saveEdit(todo.id)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={cancelEditing}
                              className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 flex flex-col gap-1">
                          <span className={cn(
                            "text-zinc-700 transition-all font-medium",
                            todo.completed && "line-through text-zinc-400"
                          )}>
                            {todo.text}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-tighter",
                              getPriorityColor(todo.priority)
                            )}>
                              {todo.priority}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => startEditing(todo)}
                            className="p-2 text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteTodo(todo.id)}
                            className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
