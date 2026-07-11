export interface Faculty {
  id: number;
  nameUz: string;
  nameRu: string;
}

export interface Department {
  id: number;
  facultyId: number;
  nameUz: string;
  nameRu: string;
  facultyNameUz: string;
  facultyNameRu: string;
}

export interface Subject {
  id: number;
  departmentId: number;
  nameUz: string;
  nameRu: string;
  description: string | null;
  departmentNameUz: string;
  departmentNameRu: string;
}

export interface Group {
  id: number;
  facultyId: number;
  name: string;
  yearOfStudy: number;
  facultyNameUz: string;
  facultyNameRu: string;
  studentCount: number;
}
