-- Jalankan HANYA pada projek Supabase PBD-UASA SKSA BARU, BUKAN Portal Koku.
-- UUID guru, kelas dan murid merujuk jadual asal Koku yang DIBACA sahaja.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pbd_subjects (
 id text PRIMARY KEY, name text NOT NULL, short_name text NOT NULL,
 min_year smallint NOT NULL DEFAULT 1 CHECK(min_year between 1 and 6),
 max_year smallint NOT NULL DEFAULT 6 CHECK(max_year between 1 and 6),
 skills jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(skills)='array'),
 is_elective boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 sort_order int NOT NULL DEFAULT 99, CHECK(max_year>=min_year)
);
CREATE TABLE IF NOT EXISTS public.pbd_teacher_access (
 teacher_id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'guru' CHECK(role IN ('admin','guru')),
 enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pbd_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL,
 class_id uuid NOT NULL, subject_id text NOT NULL REFERENCES public.pbd_subjects(id),
 academic_year int NOT NULL CHECK(academic_year BETWEEN 2020 AND 2100),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(teacher_id,class_id,subject_id,academic_year)
);
CREATE TABLE IF NOT EXISTS public.pbd_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 academic_year int NOT NULL CHECK(academic_year BETWEEN 2020 AND 2100),
 class_id uuid NOT NULL, student_id uuid NOT NULL,
 subject_id text NOT NULL REFERENCES public.pbd_subjects(id),
 assessment_type text NOT NULL CHECK(assessment_type IN ('pbd','uasa')),
 term text NOT NULL CHECK(term IN ('pertengahan','akhir')),
 tp smallint CHECK(tp BETWEEN 1 AND 6),
 skills jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(skills)='object'),
 remarks text NOT NULL DEFAULT '', intervention text NOT NULL DEFAULT '',
 effort text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draf'
 CHECK(status IN ('draf','lengkap','tidak_berkaitan','tidak_hadir')),
 score numeric(5,2) CHECK(score BETWEEN 0 AND 100),
 grade text CHECK(grade IN ('A','B','C','D','E','F')),
 updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(academic_year,class_id,student_id,subject_id,assessment_type,term),
 CHECK((assessment_type='pbd' AND score IS NULL AND grade IS NULL) OR
       (assessment_type='uasa' AND term='akhir' AND tp IS NULL))
);
CREATE INDEX IF NOT EXISTS pbd_records_class_idx ON public.pbd_records(academic_year,class_id,subject_id,assessment_type,term);
CREATE INDEX IF NOT EXISTS pbd_assignments_teacher_idx ON public.pbd_assignments(teacher_id,academic_year);
CREATE TABLE IF NOT EXISTS public.pbd_login_attempts (
 fingerprint text PRIMARY KEY, attempts int NOT NULL DEFAULT 0,
 window_start timestamptz NOT NULL DEFAULT now(), blocked_until timestamptz
);
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['pbd_subjects','pbd_teacher_access','pbd_assignments','pbd_records','pbd_login_attempts'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon,authenticated',tbl);
  EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',tbl);
 END LOOP;
END $$;
INSERT INTO public.pbd_subjects(id,name,short_name,min_year,max_year,skills,is_elective,sort_order) VALUES
('BM','Bahasa Melayu','BM',1,6,'["Mendengar dan Bertutur","Membaca","Menulis","Seni Bahasa","Tatabahasa"]',false,1),
('BI','Bahasa Inggeris','BI',1,6,'["Listening","Speaking","Reading","Writing","Language Arts"]',false,2),
('MT','Matematik','MT',1,6,'[]',false,3),
('SN','Sains','SN',1,6,'[]',false,4),
('PI','Pendidikan Islam','PI',1,6,'[]',false,5),
('PM','Pendidikan Moral','PM',1,6,'[]',false,6),
('PJPK','Pendidikan Jasmani dan Pendidikan Kesihatan','PJPK',1,6,'[]',false,7),
('PSV','Pendidikan Seni Visual','PSV',1,6,'[]',false,8),
('MZ','Pendidikan Muzik','MZ',1,6,'[]',false,9),
('BA','Bahasa Arab','BA',1,6,'[]',true,10),
('SJ','Sejarah','SJ',4,6,'[]',false,11),
('RBT','Reka Bentuk dan Teknologi','RBT',4,6,'[]',false,12),
('BCSK','Bahasa Cina Sekolah Kebangsaan','BCSK',1,6,'[]',true,13),
('BTSK','Bahasa Tamil Sekolah Kebangsaan','BTSK',1,6,'[]',true,14),
('BIban','Bahasa Iban','B.Iban',1,6,'[]',true,15),
('BKD','Bahasa Kadazandusun','BKD',1,6,'[]',true,16),
('BSem','Bahasa Semai','BSem',1,6,'[]',true,17)
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.pbd_teacher_access(teacher_id,role,enabled)
VALUES ('d69f2851-af80-5786-9bf8-7f7463c68418','admin',true)
ON CONFLICT(teacher_id) DO UPDATE SET role='admin',enabled=true;
COMMIT;
