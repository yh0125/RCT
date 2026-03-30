import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, { ...options, cache: "no-store" });
    },
  },
});

export type Patient = {
  id: string;
  patient_code: string;
  age: number;
  gender: string;
  disease_type: string;
  modality: string;
  group_assignment: string;
  consent_given: boolean;
  status: string;
  created_at: string;
};

export type RandomizationSlot = {
  id: number;
  sequence_number: number;
  block_number: number;
  stratification: string;
  group_assignment: string;
  patient_id: string | null;
  is_used: boolean;
};

export type QuestionnaireResponse = {
  id: string;
  patient_id: string;
  question_key: string;
  response_value: number;
  created_at: string;
};
