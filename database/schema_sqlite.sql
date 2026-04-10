-- BrightHut database schema (SQLite 3)
-- Same tables/constraints as schema.sql (PostgreSQL), adapted for SQLite.
-- Booleans stored as INTEGER 0/1. Datetimes stored as TEXT (ISO-8601) or CURRENT_TIMESTAMP.

PRAGMA foreign_keys = ON;

-- ---------- Core reference tables ----------

CREATE TABLE IF NOT EXISTS safehouses (
  safehouse_id INTEGER PRIMARY KEY,
  safehouse_code TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Philippines',
  open_date TEXT,
  status TEXT NOT NULL,
  capacity_girls INTEGER,
  capacity_staff INTEGER,
  current_occupancy INTEGER,
  notes TEXT,
  CONSTRAINT safehouses_region_chk CHECK (region IN ('Luzon','Visayas','Mindanao')),
  CONSTRAINT safehouses_status_chk CHECK (status IN ('Active','Inactive')),
  CONSTRAINT safehouses_code_uk UNIQUE (safehouse_code)
);

CREATE TABLE IF NOT EXISTS partners (
  partner_id INTEGER PRIMARY KEY,
  partner_name TEXT NOT NULL,
  partner_type TEXT NOT NULL,
  role_type TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  region TEXT,
  status TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  CONSTRAINT partners_partner_type_chk CHECK (partner_type IN ('Organization','Individual')),
  CONSTRAINT partners_role_type_chk CHECK (role_type IN ('Education','Evaluation','SafehouseOps','FindSafehouse','Logistics','Transport','Maintenance')),
  CONSTRAINT partners_status_chk CHECK (status IN ('Active','Inactive'))
);

CREATE TABLE IF NOT EXISTS partner_assignments (
  assignment_id INTEGER PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(partner_id),
  safehouse_id INTEGER REFERENCES safehouses(safehouse_id),
  program_area TEXT NOT NULL,
  assignment_start TEXT,
  assignment_end TEXT,
  responsibility_notes TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  status TEXT NOT NULL,
  CONSTRAINT partner_assignments_program_area_chk CHECK (program_area IN ('Education','Wellbeing','Operations','Transport','Maintenance')),
  CONSTRAINT partner_assignments_status_chk CHECK (status IN ('Active','Ended'))
);

CREATE TABLE IF NOT EXISTS supporters (
  supporter_id INTEGER PRIMARY KEY,
  supporter_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  organization_name TEXT,
  first_name TEXT,
  last_name TEXT,
  relationship_type TEXT NOT NULL,
  region TEXT,
  country TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL,
  first_donation_date TEXT,
  acquisition_channel TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT supporters_supporter_type_chk CHECK (supporter_type IN ('MonetaryDonor','InKindDonor','Volunteer','SkillsContributor','SocialMediaAdvocate','PartnerOrganization')),
  CONSTRAINT supporters_relationship_type_chk CHECK (relationship_type IN ('Local','International','PartnerOrganization')),
  CONSTRAINT supporters_status_chk CHECK (status IN ('Active','Inactive')),
  CONSTRAINT supporters_acquisition_channel_chk CHECK (acquisition_channel IS NULL OR acquisition_channel IN ('Website','SocialMedia','Event','WordOfMouth','PartnerReferral','Church'))
);

CREATE TABLE IF NOT EXISTS social_media_posts (
  post_id INTEGER PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  post_url TEXT,
  created_at TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  post_hour INTEGER NOT NULL,
  post_type TEXT NOT NULL,
  media_type TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT,
  num_hashtags INTEGER,
  mentions_count INTEGER,
  has_call_to_action INTEGER NOT NULL DEFAULT 0 CHECK (has_call_to_action IN (0, 1)),
  call_to_action_type TEXT,
  content_topic TEXT NOT NULL,
  sentiment_tone TEXT NOT NULL,
  caption_length INTEGER,
  features_resident_story INTEGER NOT NULL DEFAULT 0 CHECK (features_resident_story IN (0, 1)),
  campaign_name TEXT,
  is_boosted INTEGER NOT NULL DEFAULT 0 CHECK (is_boosted IN (0, 1)),
  boost_budget_php NUMERIC,
  impressions INTEGER,
  reach INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  click_throughs INTEGER,
  video_views INTEGER,
  engagement_rate NUMERIC,
  profile_visits INTEGER,
  donation_referrals INTEGER,
  estimated_donation_value_php NUMERIC,
  follower_count_at_post INTEGER,
  watch_time_seconds INTEGER,
  avg_view_duration_seconds INTEGER,
  subscriber_count_at_post INTEGER,
  forwards INTEGER,
  CONSTRAINT social_media_posts_platform_chk CHECK (platform IN ('Facebook','Instagram','Twitter','TikTok','LinkedIn','YouTube','WhatsApp')),
  CONSTRAINT social_media_posts_post_hour_chk CHECK (post_hour BETWEEN 0 AND 23),
  CONSTRAINT social_media_posts_post_type_chk CHECK (post_type IN ('ImpactStory','Campaign','EventPromotion','ThankYou','EducationalContent','FundraisingAppeal')),
  CONSTRAINT social_media_posts_media_type_chk CHECK (media_type IN ('Photo','Video','Carousel','Text','Reel')),
  CONSTRAINT social_media_posts_call_to_action_type_chk CHECK (call_to_action_type IS NULL OR call_to_action_type IN ('DonateNow','LearnMore','ShareStory','SignUp')),
  CONSTRAINT social_media_posts_content_topic_chk CHECK (content_topic IN ('Education','Health','Reintegration','DonorImpact','SafehouseLife','EventRecap','CampaignLaunch','Gratitude','AwarenessRaising')),
  CONSTRAINT social_media_posts_sentiment_tone_chk CHECK (sentiment_tone IN ('Hopeful','Urgent','Celebratory','Informative','Grateful','Emotional')),
  CONSTRAINT social_media_posts_platform_post_uk UNIQUE (platform, platform_post_id)
);

CREATE TABLE IF NOT EXISTS donations (
  donation_id INTEGER PRIMARY KEY,
  supporter_id INTEGER NOT NULL REFERENCES supporters(supporter_id),
  donation_type TEXT NOT NULL,
  donation_date TEXT NOT NULL,
  channel_source TEXT NOT NULL,
  currency_code TEXT,
  amount NUMERIC,
  estimated_value NUMERIC,
  impact_unit TEXT NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring IN (0, 1)),
  campaign_name TEXT,
  notes TEXT,
  created_by_partner_id INTEGER REFERENCES partners(partner_id),
  referral_post_id INTEGER REFERENCES social_media_posts(post_id),
  CONSTRAINT donations_donation_type_chk CHECK (donation_type IN ('Monetary','InKind','Time','Skills','SocialMedia')),
  CONSTRAINT donations_channel_source_chk CHECK (channel_source IN ('Campaign','Event','Direct','SocialMedia','PartnerReferral')),
  CONSTRAINT donations_impact_unit_chk CHECK (impact_unit IN ('pesos','items','hours','campaigns'))
);

CREATE TABLE IF NOT EXISTS in_kind_donation_items (
  item_id INTEGER PRIMARY KEY,
  donation_id INTEGER NOT NULL REFERENCES donations(donation_id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_of_measure TEXT NOT NULL,
  estimated_unit_value NUMERIC,
  intended_use TEXT NOT NULL,
  received_condition TEXT NOT NULL,
  CONSTRAINT in_kind_item_category_chk CHECK (item_category IN ('Food','Supplies','Clothing','SchoolMaterials','Hygiene','Furniture','Medical')),
  CONSTRAINT in_kind_uom_chk CHECK (unit_of_measure IN ('pcs','boxes','kg','sets','packs')),
  CONSTRAINT in_kind_intended_use_chk CHECK (intended_use IN ('Meals','Education','Shelter','Hygiene','Health')),
  CONSTRAINT in_kind_received_condition_chk CHECK (received_condition IN ('New','Good','Fair'))
);

CREATE TABLE IF NOT EXISTS donation_allocations (
  allocation_id INTEGER PRIMARY KEY,
  donation_id INTEGER NOT NULL REFERENCES donations(donation_id) ON DELETE CASCADE,
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  program_area TEXT NOT NULL,
  amount_allocated NUMERIC NOT NULL,
  allocation_date TEXT,
  allocation_notes TEXT,
  CONSTRAINT donation_allocations_program_area_chk CHECK (program_area IN ('Education','Wellbeing','Operations','Transport','Maintenance','Outreach'))
);

CREATE TABLE IF NOT EXISTS residents (
  resident_id INTEGER PRIMARY KEY,
  case_control_no TEXT NOT NULL,
  internal_code TEXT NOT NULL,
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  case_status TEXT NOT NULL,
  sex TEXT NOT NULL,
  date_of_birth TEXT,
  birth_status TEXT,
  place_of_birth TEXT,
  religion TEXT,
  case_category TEXT NOT NULL,
  sub_cat_orphaned INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_orphaned IN (0, 1)),
  sub_cat_trafficked INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_trafficked IN (0, 1)),
  sub_cat_child_labor INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_child_labor IN (0, 1)),
  sub_cat_physical_abuse INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_physical_abuse IN (0, 1)),
  sub_cat_sexual_abuse INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_sexual_abuse IN (0, 1)),
  sub_cat_osaec INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_osaec IN (0, 1)),
  sub_cat_cicl INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_cicl IN (0, 1)),
  sub_cat_at_risk INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_at_risk IN (0, 1)),
  sub_cat_street_child INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_street_child IN (0, 1)),
  sub_cat_child_with_hiv INTEGER NOT NULL DEFAULT 0 CHECK (sub_cat_child_with_hiv IN (0, 1)),
  is_pwd INTEGER NOT NULL DEFAULT 0 CHECK (is_pwd IN (0, 1)),
  pwd_type TEXT,
  has_special_needs INTEGER NOT NULL DEFAULT 0 CHECK (has_special_needs IN (0, 1)),
  special_needs_diagnosis TEXT,
  family_is_4ps INTEGER NOT NULL DEFAULT 0 CHECK (family_is_4ps IN (0, 1)),
  family_solo_parent INTEGER NOT NULL DEFAULT 0 CHECK (family_solo_parent IN (0, 1)),
  family_indigenous INTEGER NOT NULL DEFAULT 0 CHECK (family_indigenous IN (0, 1)),
  family_parent_pwd INTEGER NOT NULL DEFAULT 0 CHECK (family_parent_pwd IN (0, 1)),
  family_informal_settler INTEGER NOT NULL DEFAULT 0 CHECK (family_informal_settler IN (0, 1)),
  date_of_admission TEXT,
  age_upon_admission TEXT,
  present_age TEXT,
  length_of_stay TEXT,
  referral_source TEXT,
  referring_agency_person TEXT,
  date_colb_registered TEXT,
  date_colb_obtained TEXT,
  assigned_social_worker TEXT,
  initial_case_assessment TEXT,
  date_case_study_prepared TEXT,
  reintegration_type TEXT,
  reintegration_status TEXT,
  initial_risk_level TEXT,
  current_risk_level TEXT,
  date_enrolled TEXT,
  date_closed TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  notes_restricted TEXT,
  CONSTRAINT residents_case_status_chk CHECK (case_status IN ('Active','Closed','Transferred')),
  CONSTRAINT residents_sex_chk CHECK (sex IN ('F')),
  CONSTRAINT residents_birth_status_chk CHECK (birth_status IS NULL OR birth_status IN ('Marital','Non-Marital')),
  CONSTRAINT residents_case_category_chk CHECK (case_category IN ('Abandoned','Foundling','Surrendered','Neglected')),
  CONSTRAINT residents_referral_source_chk CHECK (referral_source IS NULL OR referral_source IN ('Government Agency','NGO','Police','Self-Referral','Community','Court Order')),
  CONSTRAINT residents_reintegration_type_chk CHECK (reintegration_type IS NULL OR reintegration_type IN ('Family Reunification','Foster Care','Adoption (Domestic)','Adoption (Inter-Country)','Independent Living','None')),
  CONSTRAINT residents_reintegration_status_chk CHECK (reintegration_status IS NULL OR reintegration_status IN ('Not Started','In Progress','Completed','On Hold')),
  CONSTRAINT residents_risk_level_chk CHECK (
    (initial_risk_level IS NULL OR initial_risk_level IN ('Low','Medium','High','Critical'))
    AND
    (current_risk_level IS NULL OR current_risk_level IN ('Low','Medium','High','Critical'))
  ),
  CONSTRAINT residents_case_control_uk UNIQUE (case_control_no),
  CONSTRAINT residents_internal_code_uk UNIQUE (internal_code)
);

CREATE TABLE IF NOT EXISTS process_recordings (
  recording_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  social_worker TEXT,
  session_type TEXT NOT NULL,
  session_duration_minutes INTEGER,
  emotional_state_observed TEXT,
  emotional_state_end TEXT,
  session_narrative TEXT,
  interventions_applied TEXT,
  follow_up_actions TEXT,
  progress_noted INTEGER NOT NULL DEFAULT 0 CHECK (progress_noted IN (0, 1)),
  concerns_flagged INTEGER NOT NULL DEFAULT 0 CHECK (concerns_flagged IN (0, 1)),
  referral_made INTEGER NOT NULL DEFAULT 0 CHECK (referral_made IN (0, 1)),
  notes_restricted TEXT,
  CONSTRAINT process_recordings_session_type_chk CHECK (session_type IN ('Individual','Group')),
  CONSTRAINT process_recordings_emotional_state_obs_chk CHECK (emotional_state_observed IS NULL OR emotional_state_observed IN ('Calm','Anxious','Sad','Angry','Hopeful','Withdrawn','Happy','Distressed')),
  CONSTRAINT process_recordings_emotional_state_end_chk CHECK (emotional_state_end IS NULL OR emotional_state_end IN ('Calm','Anxious','Sad','Angry','Hopeful','Withdrawn','Happy','Distressed'))
);

CREATE TABLE IF NOT EXISTS home_visitations (
  visitation_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  visit_date TEXT NOT NULL,
  social_worker TEXT,
  visit_type TEXT NOT NULL,
  location_visited TEXT,
  family_members_present TEXT,
  purpose TEXT,
  observations TEXT,
  family_cooperation_level TEXT,
  safety_concerns_noted INTEGER NOT NULL DEFAULT 0 CHECK (safety_concerns_noted IN (0, 1)),
  follow_up_needed INTEGER NOT NULL DEFAULT 0 CHECK (follow_up_needed IN (0, 1)),
  follow_up_notes TEXT,
  visit_outcome TEXT,
  CONSTRAINT home_visitations_visit_type_chk CHECK (visit_type IN ('Initial Assessment','Routine Follow-Up','Reintegration Assessment','Post-Placement Monitoring','Emergency')),
  CONSTRAINT home_visitations_family_coop_chk CHECK (family_cooperation_level IS NULL OR family_cooperation_level IN ('Highly Cooperative','Cooperative','Neutral','Uncooperative')),
  CONSTRAINT home_visitations_visit_outcome_chk CHECK (visit_outcome IS NULL OR visit_outcome IN ('Favorable','Needs Improvement','Unfavorable','Inconclusive'))
);

-- Column layout matches database/seed-csv/education_records.csv (differs from data-dictionary PostgreSQL shape).
CREATE TABLE IF NOT EXISTS education_records (
  education_record_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  record_date TEXT NOT NULL,
  education_level TEXT NOT NULL,
  school_name TEXT,
  enrollment_status TEXT,
  attendance_rate NUMERIC,
  progress_percent NUMERIC,
  completion_status TEXT NOT NULL,
  notes TEXT
);

-- Column layout matches database/seed-csv/health_wellbeing_records.csv (names differ slightly from PostgreSQL schema).
CREATE TABLE IF NOT EXISTS health_wellbeing_records (
  health_record_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  record_date TEXT NOT NULL,
  general_health_score NUMERIC,
  nutrition_score NUMERIC,
  sleep_quality_score NUMERIC,
  energy_level_score NUMERIC,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  bmi NUMERIC,
  medical_checkup_done INTEGER NOT NULL DEFAULT 0 CHECK (medical_checkup_done IN (0, 1)),
  dental_checkup_done INTEGER NOT NULL DEFAULT 0 CHECK (dental_checkup_done IN (0, 1)),
  psychological_checkup_done INTEGER NOT NULL DEFAULT 0 CHECK (psychological_checkup_done IN (0, 1)),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS intervention_plans (
  plan_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  plan_category TEXT NOT NULL,
  plan_description TEXT NOT NULL,
  services_provided TEXT,
  target_value NUMERIC,
  target_date TEXT,
  status TEXT NOT NULL,
  case_conference_date TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT intervention_plans_category_chk CHECK (plan_category IN ('Safety','Psychosocial','Education','Physical Health','Legal','Reintegration')),
  CONSTRAINT intervention_plans_status_chk CHECK (status IN ('Open','In Progress','Achieved','On Hold','Closed'))
);

CREATE TABLE IF NOT EXISTS incident_reports (
  incident_id INTEGER PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  incident_date TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  response_taken TEXT,
  resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
  resolution_date TEXT,
  reported_by TEXT,
  follow_up_required INTEGER NOT NULL DEFAULT 0 CHECK (follow_up_required IN (0, 1)),
  CONSTRAINT incident_reports_type_chk CHECK (incident_type IN ('Behavioral','Medical','Security','RunawayAttempt','SelfHarm','ConflictWithPeer','PropertyDamage')),
  CONSTRAINT incident_reports_severity_chk CHECK (severity IN ('Low','Medium','High'))
);

CREATE TABLE IF NOT EXISTS safehouse_monthly_metrics (
  metric_id INTEGER PRIMARY KEY,
  safehouse_id INTEGER NOT NULL REFERENCES safehouses(safehouse_id),
  month_start TEXT NOT NULL,
  month_end TEXT NOT NULL,
  active_residents INTEGER,
  avg_education_progress NUMERIC,
  avg_health_score NUMERIC,
  process_recording_count INTEGER,
  home_visitation_count INTEGER,
  incident_count INTEGER,
  notes TEXT,
  CONSTRAINT safehouse_monthly_metrics_month_uk UNIQUE (safehouse_id, month_start)
);

CREATE TABLE IF NOT EXISTS public_impact_snapshots (
  snapshot_id INTEGER PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  headline TEXT,
  summary_text TEXT,
  metric_payload_json TEXT,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  published_at TEXT,
  CONSTRAINT public_impact_snapshots_month_uk UNIQUE (snapshot_date)
);

-- ---------- Users (authentication) ----------

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'donor')),
  first_name TEXT,
  last_name TEXT,
  organization_name TEXT,
  phone TEXT,
  country TEXT,
  region TEXT,
  relationship_type TEXT,
  acquisition_channel TEXT,
  supporter_type TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  google_sub TEXT,
  google_profile_completed INTEGER NOT NULL DEFAULT 0,
  two_factor_secret TEXT,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_partner_assignments_partner_id ON partner_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_assignments_safehouse_id ON partner_assignments(safehouse_id);
CREATE INDEX IF NOT EXISTS idx_donations_supporter_id ON donations(supporter_id);
CREATE INDEX IF NOT EXISTS idx_donations_referral_post_id ON donations(referral_post_id);
CREATE INDEX IF NOT EXISTS idx_in_kind_donation_items_donation_id ON in_kind_donation_items(donation_id);
CREATE INDEX IF NOT EXISTS idx_donation_allocations_donation_id ON donation_allocations(donation_id);
CREATE INDEX IF NOT EXISTS idx_donation_allocations_safehouse_id ON donation_allocations(safehouse_id);
CREATE INDEX IF NOT EXISTS idx_residents_safehouse_id ON residents(safehouse_id);
CREATE INDEX IF NOT EXISTS idx_process_recordings_resident_id ON process_recordings(resident_id);
CREATE INDEX IF NOT EXISTS idx_home_visitations_resident_id ON home_visitations(resident_id);
CREATE INDEX IF NOT EXISTS idx_education_records_resident_id ON education_records(resident_id);
CREATE INDEX IF NOT EXISTS idx_health_records_resident_id ON health_wellbeing_records(resident_id);
CREATE INDEX IF NOT EXISTS idx_intervention_plans_resident_id ON intervention_plans(resident_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_resident_id ON incident_reports(resident_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_safehouse_id ON incident_reports(safehouse_id);
CREATE INDEX IF NOT EXISTS idx_safehouse_monthly_metrics_safehouse_id ON safehouse_monthly_metrics(safehouse_id);
