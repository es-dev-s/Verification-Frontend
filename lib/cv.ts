/** @deprecated Use lib/types.ts — kept temporarily for import compatibility. */
export {
  UNCERTAIN_THRESHOLD,
  emptyBachelors as emptyEducation,
  emptyExperience,
} from "./types";

export type Personal = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type Education = {
  institution: string | null;
  degree: string | null;
  field: string | null;
  start: string | null;
  end: string | null;
};

export type Experience = {
  company: string | null;
  title: string | null;
  start: string | null;
  end: string | null;
  description: string | null;
};
