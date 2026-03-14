/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Database, 
  CheckCircle2, 
  AlertCircle,
  GraduationCap,
  ShieldCheck,
  Search,
  LogIn,
  LogOut,
  UserCog
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QlChiDoan, TaiKhoan } from './types';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  getDocs,
  where
} from './firebase';
import { serverTimestamp } from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  public state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Đã xảy ra lỗi không mong muốn.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          errorMessage = `Lỗi Firestore (${parsed.operationType}): ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-rose-100">
            <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center text-rose-600 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Rất tiếc!</h2>
            <p className="text-slate-600">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<TaiKhoan | null>(null);
  const [activeTab, setActiveTab] = useState<'qlchidoan' | 'taikhoan'>('qlchidoan');
  
  const [qlChiDoan, setQlChiDoan] = useState<QlChiDoan[]>([]);
  const [taiKhoanList, setTaiKhoanList] = useState<TaiKhoan[]>([]);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [confirmDelete, setConfirmDelete] = useState<{id: string, type: 'qlchidoan' | 'taikhoan'} | null>(null);

  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({
    type: null,
    message: ''
  });

  const handleFirestoreError = (error: any, operation: OperationType, path: string) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: operation,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setStatus({ type: 'error', message: 'Đã xảy ra lỗi khi truy cập dữ liệu.' });
  };

  // Seed Admin Account if not exists, and clean up duplicates
  useEffect(() => {
    const seedAdmin = async () => {
      try {
        const q = query(collection(db, 'taikhoan'), where('username', '==', 'Admin'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          const id = Date.now().toString();
          await setDoc(doc(db, 'taikhoan', id), {
            username: 'Admin',
            password: '123',
            fullName: 'Quản trị viên hệ thống',
            role: 'Admin',
            chiDoan: '',
            updatedAt: serverTimestamp()
          });
          console.log('Đã tạo tài khoản Admin mặc định.');
        } else if (snapshot.docs.length > 1) {
          // Keep the first one, delete the rest
          const [firstDoc, ...duplicates] = snapshot.docs;
          for (const duplicate of duplicates) {
            await deleteDoc(doc(db, 'taikhoan', duplicate.id));
          }
          console.log(`Đã xóa ${duplicates.length} tài khoản Admin bị trùng lặp.`);
        }
      } catch (error) {
        console.error('Lỗi khi tạo/kiểm tra tài khoản Admin:', error);
      }
    };
    seedAdmin();
  }, []);

  // Fetch QlChiDoan (Always visible)
  useEffect(() => {
    const q = query(collection(db, 'qlchidoan'), orderBy('tenchidoan', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QlChiDoan[];
      setQlChiDoan(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'qlchidoan');
    });
    return () => unsubscribe();
  }, []);

  // Fetch TaiKhoan (Only if Admin)
  useEffect(() => {
    if (currentUser?.role !== 'Admin') {
      setTaiKhoanList([]);
      return;
    }
    const q = query(collection(db, 'taikhoan'), orderBy('username', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaiKhoan[];
      setTaiKhoanList(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'taikhoan');
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Đang đăng nhập...' });
    try {
      const q = query(
        collection(db, 'taikhoan'), 
        where('username', '==', loginForm.username),
        where('password', '==', loginForm.password)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as TaiKhoan;
        setCurrentUser(userData);
        setIsLoginModalOpen(false);
        setLoginForm({ username: '', password: '' });
        setStatus({ type: 'success', message: 'Đăng nhập thành công!' });
      } else {
        setStatus({ type: 'error', message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: 'Lỗi đăng nhập: ' + error.message });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('qlchidoan');
    setStatus({ type: 'success', message: 'Đã đăng xuất.' });
  };

  // --- QL Chi Đoàn CRUD ---
  const handleAddQlChiDoan = async () => {
    if (!currentUser) return;
    const data = formData as QlChiDoan;
    if (!data.tenchidoan) return;
    
    setStatus({ type: 'loading', message: 'Đang lưu...' });
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'qlchidoan', id), {
        tenchidoan: data.tenchidoan,
        doanvien: Number(data.doanvien) || 0,
        thanhnien: Number(data.thanhnien) || 0,
        tongso: Number(data.tongso) || 0,
        phonghoc: data.phonghoc || '',
        bithu: data.bithu || '',
        thongtinthem: data.thongtinthem || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Đã thêm thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'qlchidoan');
    }
  };

  const handleUpdateQlChiDoan = async () => {
    if (!isEditing || !currentUser) return;
    const data = formData as QlChiDoan;
    
    setStatus({ type: 'loading', message: 'Đang cập nhật...' });
    try {
      const { id, ...dataToUpdate } = data;
      await updateDoc(doc(db, 'qlchidoan', isEditing), {
        ...dataToUpdate,
        doanvien: Number(data.doanvien) || 0,
        thanhnien: Number(data.thanhnien) || 0,
        tongso: Number(data.tongso) || 0,
        phonghoc: data.phonghoc || '',
        bithu: data.bithu || '',
        thongtinthem: data.thongtinthem || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Cập nhật thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `qlchidoan/${isEditing}`);
    }
  };

  const handleDeleteQlChiDoan = async (id: string) => {
    if (!currentUser) return;
    setStatus({ type: 'loading', message: 'Đang xóa...' });
    try {
      await deleteDoc(doc(db, 'qlchidoan', id));
      setStatus({ type: 'success', message: 'Đã xóa.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `qlchidoan/${id}`);
    }
  };

  // --- Tài Khoản CRUD ---
  const handleAddTaiKhoan = async () => {
    if (currentUser?.role !== 'Admin') return;
    const data = formData as TaiKhoan;
    if (!data.username || !data.password || !data.fullName || !data.role) return;
    
    setStatus({ type: 'loading', message: 'Đang lưu...' });
    try {
      // Check if username exists
      const q = query(collection(db, 'taikhoan'), where('username', '==', data.username));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setStatus({ type: 'error', message: 'Tên đăng nhập đã tồn tại!' });
        return;
      }

      const id = Date.now().toString();
      await setDoc(doc(db, 'taikhoan', id), {
        username: data.username,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        chiDoan: data.chiDoan || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Đã thêm tài khoản thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'taikhoan');
    }
  };

  const handleUpdateTaiKhoan = async () => {
    if (!isEditing || currentUser?.role !== 'Admin') return;
    const data = formData as TaiKhoan;
    
    // Fallback for legacy 'User' role if it wasn't changed in the dropdown
    let roleToSave = data.role || 'DV';
    if (roleToSave === 'User') {
      roleToSave = 'DV';
    }

    setStatus({ type: 'loading', message: 'Đang cập nhật...' });
    try {
      const { id, ...dataToUpdate } = data;
      await updateDoc(doc(db, 'taikhoan', isEditing), {
        ...dataToUpdate,
        role: roleToSave,
        chiDoan: data.chiDoan || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Cập nhật tài khoản thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `taikhoan/${isEditing}`);
    }
  };

  const handleDeleteTaiKhoan = async (id: string) => {
    if (currentUser?.role !== 'Admin') return;
    setStatus({ type: 'loading', message: 'Đang xóa...' });
    try {
      await deleteDoc(doc(db, 'taikhoan', id));
      setStatus({ type: 'success', message: 'Đã xóa tài khoản.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `taikhoan/${id}`);
    }
  };

  const filteredQlChiDoan = qlChiDoan.filter(item => 
    item.tenchidoan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.bithu.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTaiKhoan = taiKhoanList.filter(item => 
    item.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <GraduationCap size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hệ thống quản lý điểm thi đua</h1>
              <p className="text-blue-100 text-sm font-medium">Trường THPT Lê Hoàn</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3 bg-white/10 p-1 pr-4 rounded-full backdrop-blur-sm">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold border border-white/20">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold leading-none">{currentUser.fullName}</p>
                  <p className="text-[10px] text-blue-200">{currentUser.role}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors ml-2"
                  title="Đăng xuất"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-2 bg-white text-primary px-6 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95 hover:bg-blue-50"
              >
                <LogIn size={18} />
                Đăng nhập
              </button>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        {currentUser && (
          <div className="max-w-7xl mx-auto px-4 flex gap-2 mt-2">
            <button
              onClick={() => setActiveTab('qlchidoan')}
              className={cn(
                "px-6 py-3 rounded-t-xl font-medium transition-colors flex items-center gap-2",
                activeTab === 'qlchidoan' ? "bg-slate-50 text-primary" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <Users size={18} />
              Quản lý chi đoàn
            </button>
            {currentUser.role === 'Admin' && (
              <button
                onClick={() => setActiveTab('taikhoan')}
                className={cn(
                  "px-6 py-3 rounded-t-xl font-medium transition-colors flex items-center gap-2",
                  activeTab === 'taikhoan' ? "bg-slate-50 text-primary" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                <UserCog size={18} />
                Quản lý tài khoản
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        <div className="space-y-6">
          {/* Status Message */}
          <AnimatePresence>
            {status.type && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "p-4 rounded-2xl flex items-center gap-3 shadow-sm border",
                  status.type === 'success' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                  status.type === 'error' ? "bg-rose-50 text-rose-700 border-rose-100" :
                  "bg-blue-50 text-blue-700 border-blue-100"
                )}
              >
                {status.type === 'success' ? <CheckCircle2 size={20} /> : 
                 status.type === 'error' ? <AlertCircle size={20} /> : 
                 <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />}
                <span className="font-medium">{status.message}</span>
                <button onClick={() => setStatus({ type: null, message: '' })} className="ml-auto p-1 hover:bg-black/5 rounded-lg">
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Content: QL Chi Đoàn */}
          {activeTab === 'qlchidoan' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl text-primary">
                    <Users size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Danh sách Chi đoàn</h2>
                    <p className="text-sm text-slate-500">Quản lý thông tin các chi đoàn trong trường</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Tìm kiếm chi đoàn..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    />
                  </div>
                  {currentUser && (
                    <button
                      onClick={() => {
                        setFormData({});
                        setIsEditing('new_qlchidoan');
                      }}
                      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap"
                    >
                      <Plus size={18} />
                      <span className="hidden sm:inline">Thêm mới</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                      <th className="py-2 px-3 font-semibold">Tên chi đoàn</th>
                      <th className="py-2 px-3 font-semibold text-center">Đoàn viên</th>
                      <th className="py-2 px-3 font-semibold text-center">Thanh niên</th>
                      <th className="py-2 px-3 font-semibold text-center">Tổng số</th>
                      <th className="py-2 px-3 font-semibold">Phòng học</th>
                      <th className="py-2 px-3 font-semibold">Bí thư</th>
                      {currentUser && <th className="py-2 px-3 font-semibold text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredQlChiDoan.length === 0 ? (
                      <tr>
                        <td colSpan={currentUser ? 7 : 6} className="py-6 px-3 text-center text-slate-500">
                          <Database size={32} className="mx-auto mb-2 text-slate-300" />
                          <p>Chưa có dữ liệu chi đoàn nào.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredQlChiDoan.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-2 px-3 font-medium text-slate-800">{item.tenchidoan}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{item.doanvien}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{item.thanhnien}</td>
                          <td className="py-2 px-3 text-center font-semibold text-primary">{item.tongso}</td>
                          <td className="py-2 px-3 text-slate-600">{item.phonghoc}</td>
                          <td className="py-2 px-3 text-slate-600">{item.bithu}</td>
                          {currentUser && (
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setFormData(item);
                                    setIsEditing(item.id);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Sửa"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete({ id: item.id, type: 'qlchidoan' })}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Xóa"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredQlChiDoan.length === 0 ? (
                  <div className="py-6 px-3 text-center text-slate-500">
                    <Database size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>Chưa có dữ liệu chi đoàn nào.</p>
                  </div>
                ) : (
                  filteredQlChiDoan.map((item) => (
                    <div key={item.id} className="p-3 space-y-2 hover:bg-slate-50/80 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{item.tenchidoan}</h3>
                          <p className="text-xs text-slate-500">Bí thư: {item.bithu || 'Chưa cập nhật'}</p>
                        </div>
                        <div className="text-right">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                            Tổng: {item.tongso}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <div>Đoàn viên: <span className="font-medium text-slate-800">{item.doanvien}</span></div>
                        <div>Thanh niên: <span className="font-medium text-slate-800">{item.thanhnien}</span></div>
                        <div className="col-span-2">Phòng học: <span className="font-medium text-slate-800">{item.phonghoc || '-'}</span></div>
                      </div>

                      {currentUser && (
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => {
                              setFormData(item);
                              setIsEditing(item.id);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-xs font-medium"
                          >
                            <Edit2 size={14} /> Sửa
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ id: item.id, type: 'qlchidoan' })}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors text-xs font-medium"
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab Content: Tài Khoản */}
          {activeTab === 'taikhoan' && currentUser?.role === 'Admin' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                    <UserCog size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Quản lý Tài khoản</h2>
                    <p className="text-sm text-slate-500">Quản lý người dùng và quyền truy cập</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Tìm kiếm tài khoản..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setFormData({ role: 'DV' });
                      setIsEditing('new_taikhoan');
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap"
                  >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Thêm tài khoản</span>
                  </button>
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                      <th className="py-2 px-3 font-semibold">Tên đăng nhập</th>
                      <th className="py-2 px-3 font-semibold">Họ và tên</th>
                      <th className="py-2 px-3 font-semibold">Đối tượng</th>
                      <th className="py-2 px-3 font-semibold">Chi đoàn</th>
                      <th className="py-2 px-3 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredTaiKhoan.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 px-3 text-center text-slate-500">
                          <Database size={32} className="mx-auto mb-2 text-slate-300" />
                          <p>Chưa có tài khoản nào.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTaiKhoan.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-2 px-3 font-medium text-slate-800">{item.username}</td>
                          <td className="py-2 px-3 text-slate-600">{item.fullName}</td>
                          <td className="py-2 px-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-xs font-medium",
                              item.role === 'Admin' ? "bg-rose-100 text-rose-700" : 
                              item.role === 'BTV' ? "bg-purple-100 text-purple-700" :
                              item.role === 'BCH' ? "bg-amber-100 text-amber-700" :
                              item.role === 'BT' ? "bg-emerald-100 text-emerald-700" :
                              "bg-blue-100 text-blue-700"
                            )}>
                              {item.role}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{item.chiDoan || '-'}</td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setFormData(item);
                                  setIsEditing(item.id);
                                }}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Sửa"
                              >
                                <Edit2 size={16} />
                              </button>
                              {item.username !== 'Admin' && (
                                <button
                                  onClick={() => setConfirmDelete({ id: item.id, type: 'taikhoan' })}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Xóa"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredTaiKhoan.length === 0 ? (
                  <div className="py-6 px-3 text-center text-slate-500">
                    <Database size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>Chưa có tài khoản nào.</p>
                  </div>
                ) : (
                  filteredTaiKhoan.map((item) => (
                    <div key={item.id} className="p-3 space-y-2 hover:bg-slate-50/80 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{item.fullName}</h3>
                          <p className="text-xs text-slate-500">@{item.username}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-xs font-medium",
                          item.role === 'Admin' ? "bg-rose-100 text-rose-700" : 
                          item.role === 'BTV' ? "bg-purple-100 text-purple-700" :
                          item.role === 'BCH' ? "bg-amber-100 text-amber-700" :
                          item.role === 'BT' ? "bg-emerald-100 text-emerald-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {item.role}
                        </span>
                      </div>
                      
                      {item.chiDoan && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                          Chi đoàn: <span className="font-medium text-slate-800">{item.chiDoan}</span>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => {
                            setFormData(item);
                            setIsEditing(item.id);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-xs font-medium"
                        >
                          <Edit2 size={14} /> Sửa
                        </button>
                        {item.username !== 'Admin' && (
                          <button
                            onClick={() => setConfirmDelete({ id: item.id, type: 'taikhoan' })}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors text-xs font-medium"
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <LogIn className="text-primary" />
                  Đăng nhập hệ thống
                </h3>
                <button 
                  onClick={() => setIsLoginModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleLogin} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    value={loginForm.username}
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="Nhập tên đăng nhập"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="Nhập mật khẩu"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-md"
                  >
                    Đăng nhập
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit/Add QlChiDoan Modal */}
      <AnimatePresence>
        {(isEditing && isEditing !== 'new_taikhoan' && activeTab === 'qlchidoan') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800">
                  {isEditing === 'new_qlchidoan' ? 'Thêm Chi đoàn mới' : 'Cập nhật thông tin'}
                </h3>
                <button 
                  onClick={() => setIsEditing(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tên chi đoàn *</label>
                    <input
                      type="text"
                      value={formData.tenchidoan || ''}
                      onChange={e => setFormData({...formData, tenchidoan: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="VD: 10A1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng đoàn viên</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.doanvien || ''}
                      onChange={e => setFormData({...formData, doanvien: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng thanh niên</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.thanhnien || ''}
                      onChange={e => setFormData({...formData, thanhnien: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tổng số</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.tongso || ''}
                      onChange={e => setFormData({...formData, tongso: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phòng học</label>
                    <input
                      type="text"
                      value={formData.phonghoc || ''}
                      onChange={e => setFormData({...formData, phonghoc: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="VD: Phòng 101"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bí thư</label>
                    <input
                      type="text"
                      value={formData.bithu || ''}
                      onChange={e => setFormData({...formData, bithu: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Họ và tên Bí thư"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thông tin thêm</label>
                    <textarea
                      value={formData.thongtinthem || ''}
                      onChange={e => setFormData({...formData, thongtinthem: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[100px]"
                      placeholder="Ghi chú thêm..."
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(null)}
                  className="px-6 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={isEditing === 'new_qlchidoan' ? handleAddQlChiDoan : handleUpdateQlChiDoan}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-medium transition-colors shadow-md"
                >
                  <Save size={18} />
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit/Add TaiKhoan Modal */}
      <AnimatePresence>
        {(isEditing && (isEditing === 'new_taikhoan' || activeTab === 'taikhoan')) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800">
                  {isEditing === 'new_taikhoan' ? 'Thêm Tài khoản mới' : 'Cập nhật Tài khoản'}
                </h3>
                <button 
                  onClick={() => setIsEditing(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập *</label>
                  <input
                    type="text"
                    required
                    disabled={isEditing !== 'new_taikhoan'}
                    value={formData.username || ''}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="VD: gv_nguyenvana"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu *</label>
                  <input
                    type="text"
                    required
                    value={formData.password || ''}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Nhập mật khẩu"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName || ''}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Đối tượng *</label>
                  <select
                    value={formData.role || 'DV'}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  >
                    <option value="Admin">Admin (Quản trị viên)</option>
                    <option value="BTV">BTV (Ban Thường vụ)</option>
                    <option value="BCH">BCH (Ban Chấp hành)</option>
                    <option value="BT">BT (Bí thư)</option>
                    <option value="DV">DV (Đoàn viên)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên chi đoàn (Nếu có)</label>
                  <input
                    type="text"
                    value={formData.chiDoan || ''}
                    onChange={e => setFormData({...formData, chiDoan: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="VD: 10A1"
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(null)}
                  className="px-6 py-2 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={isEditing === 'new_taikhoan' ? handleAddTaiKhoan : handleUpdateTaiKhoan}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors shadow-md"
                >
                  <Save size={18} />
                  Lưu tài khoản
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* Confirm Delete Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
                <p className="text-slate-600 mb-6">
                  Bạn có chắc chắn muốn xóa {confirmDelete.type === 'qlchidoan' ? 'chi đoàn' : 'tài khoản'} này không? Hành động này không thể hoàn tác.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDelete.type === 'qlchidoan') {
                        handleDeleteQlChiDoan(confirmDelete.id);
                      } else {
                        handleDeleteTaiKhoan(confirmDelete.id);
                      }
                      setConfirmDelete(null);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Xóa ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </ErrorBoundary>
  );
}
