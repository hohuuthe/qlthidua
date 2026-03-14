export interface QlChiDoan {
  id: string;
  tenchidoan: string;
  doanvien: number;
  thanhnien: number;
  tongso: number;
  phonghoc: string;
  bithu: string;
  thongtinthem: string;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isAdmin: boolean;
}
