export interface Faculty {
  id: number;
  name: string;
}

export interface Department {
  id: number;
  facultyId: number;
  name: string;
  facultyName: string;
}

export interface Group {
  id: number;
  facultyId: number;
  name: string;
  yearOfStudy: number;
  facultyName: string;
  studentCount: number;
}
