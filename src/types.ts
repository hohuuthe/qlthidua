export interface QlChiDoan {
  id: string;
  namHoc: string;
  hocKy: string;
  tenchidoan: string;
  doanvien: number;
  thanhnien: number;
  tongso: number;
  phonghoc: string;
  bithu: string;
  thongtinthem: string;
  updatedAt?: any;
}

export interface TaiKhoan {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: string;
  chiDoan: string;
  updatedAt?: any;
}

export interface DoanVien {
  id: string;
  namHoc: string;
  hocKy: string;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  danToc: string;
  doiTuong: string;
  doanVien: boolean;
  chiDoan: string;
  ngayVaoDoan: string;
  sdt: string;
  thongTinThem: string;
  updatedAt?: any;
}

export interface TieuChiTD {
  id: string;
  namHoc: string;
  hocKy: string;
  maTieuChi: string;
  tenTieuChi: string;
  moTa: string;
  loaiTieuChi: string;
  diemTru: number;
  diemCong: number;
  ghiChu: string;
  updatedAt?: any;
}

export interface PhanCong {
  id: string;
  namHoc: string;
  hocKy: string;
  tuan: string;
  lopCham: string;
  chamLop: string;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isAdmin: boolean;
}
