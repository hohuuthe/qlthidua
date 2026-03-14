export interface ClassInfo {
  id: string;
  chiDoan: string;
  doanVien: number;
  thanhNien: number;
  tongSo: number;
  phongHoc: string;
  updatedAt?: any;
}

export interface MemberInfo {
  id: string;
  chiDoan: string;
  doanVien: number;
  thanhNien: number;
  tongSo: number;
  phongHoc: string;
  biThu: string;
  thongTinThem: string;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isAdmin: boolean;
}
