export interface ClassInfo {
  id: string;
  chiDoan: string;
  biThu: string;
  phoBiThu: string;
  uyVien: string;
  lopTruong: string;
  sdt: string;
  tongSoThanhVien: number;
  doanVien: number;
  thanhNien: number;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isAdmin: boolean;
}
