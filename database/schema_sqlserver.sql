-- ============================================================
-- BrightHut — Azure SQL Database Schema
-- Run this in your Azure SQL query window (replace the SQLite schema)
-- ============================================================

-- Drop tables in reverse FK order if re-running
IF OBJECT_ID('incident_reports','U')          IS NOT NULL DROP TABLE incident_reports;
IF OBJECT_ID('intervention_plans','U')         IS NOT NULL DROP TABLE intervention_plans;
IF OBJECT_ID('health_wellbeing_records','U')   IS NOT NULL DROP TABLE health_wellbeing_records;
IF OBJECT_ID('education_records','U')          IS NOT NULL DROP TABLE education_records;
IF OBJECT_ID('home_visitations','U')           IS NOT NULL DROP TABLE home_visitations;
IF OBJECT_ID('process_recordings','U')         IS NOT NULL DROP TABLE process_recordings;
IF OBJECT_ID('safehouse_monthly_metrics','U')  IS NOT NULL DROP TABLE safehouse_monthly_metrics;
IF OBJECT_ID('public_impact_snapshots','U')    IS NOT NULL DROP TABLE public_impact_snapshots;
IF OBJECT_ID('donation_allocations','U')       IS NOT NULL DROP TABLE donation_allocations;
IF OBJECT_ID('in_kind_donation_items','U')     IS NOT NULL DROP TABLE in_kind_donation_items;
IF OBJECT_ID('donations','U')                  IS NOT NULL DROP TABLE donations;
IF OBJECT_ID('residents','U')                  IS NOT NULL DROP TABLE residents;
IF OBJECT_ID('partner_assignments','U')        IS NOT NULL DROP TABLE partner_assignments;
IF OBJECT_ID('supporters','U')                 IS NOT NULL DROP TABLE supporters;
IF OBJECT_ID('social_media_posts','U')         IS NOT NULL DROP TABLE social_media_posts;
IF OBJECT_ID('partners','U')                   IS NOT NULL DROP TABLE partners;
IF OBJECT_ID('safehouses','U')                 IS NOT NULL DROP TABLE safehouses;
IF OBJECT_ID('users','U')                      IS NOT NULL DROP TABLE users;

-- ── safehouses ──────────────────────────────────────────────
CREATE TABLE safehouses (
  safehouse_id       INT IDENTITY(1,1) PRIMARY KEY,
  safehouse_code     NVARCHAR(50)   NOT NULL,
  name               NVARCHAR(200)  NOT NULL,
  region             NVARCHAR(50)   NOT NULL,
  city               NVARCHAR(100)  NOT NULL,
  province           NVARCHAR(100)  NOT NULL,
  country            NVARCHAR(100)  NOT NULL DEFAULT 'Philippines',
  open_date          NVARCHAR(20)   NULL,
  status             NVARCHAR(20)   NOT NULL,
  capacity_girls     INT            NULL,
  capacity_staff     INT            NULL,
  current_occupancy  INT            NULL,
  notes              NVARCHAR(MAX)  NULL,
  CONSTRAINT safehouses_region_chk CHECK (region IN ('Luzon','Visayas','Mindanao')),
  CONSTRAINT safehouses_status_chk CHECK (status IN ('Active','Inactive')),
  CONSTRAINT safehouses_code_uk UNIQUE (safehouse_code)
);

-- ── partners ────────────────────────────────────────────────
CREATE TABLE partners (
  partner_id    INT IDENTITY(1,1) PRIMARY KEY,
  partner_name  NVARCHAR(200)  NOT NULL,
  partner_type  NVARCHAR(50)   NOT NULL,
  role_type     NVARCHAR(50)   NOT NULL,
  contact_name  NVARCHAR(200)  NULL,
  email         NVARCHAR(200)  NULL,
  phone         NVARCHAR(50)   NULL,
  region        NVARCHAR(50)   NULL,
  status        NVARCHAR(20)   NOT NULL,
  start_date    NVARCHAR(20)   NULL,
  end_date      NVARCHAR(20)   NULL,
  notes         NVARCHAR(MAX)  NULL,
  CONSTRAINT partners_partner_type_chk CHECK (partner_type IN ('Organization','Individual')),
  CONSTRAINT partners_role_type_chk CHECK (role_type IN ('Education','Evaluation','SafehouseOps','FindSafehouse','Logistics','Transport','Maintenance')),
  CONSTRAINT partners_status_chk CHECK (status IN ('Active','Inactive'))
);

-- ── partner_assignments ─────────────────────────────────────
CREATE TABLE partner_assignments (
  assignment_id         INT IDENTITY(1,1) PRIMARY KEY,
  partner_id            INT           NOT NULL REFERENCES partners(partner_id),
  safehouse_id          INT           NULL     REFERENCES safehouses(safehouse_id),
  program_area          NVARCHAR(50)  NOT NULL,
  assignment_start      NVARCHAR(20)  NULL,
  assignment_end        NVARCHAR(20)  NULL,
  responsibility_notes  NVARCHAR(MAX) NULL,
  is_primary            INT           NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  status                NVARCHAR(20)  NOT NULL,
  CONSTRAINT partner_assignments_program_area_chk CHECK (program_area IN ('Education','Wellbeing','Operations','Transport','Maintenance')),
  CONSTRAINT partner_assignments_status_chk CHECK (status IN ('Active','Ended'))
);

-- ── supporters ──────────────────────────────────────────────
CREATE TABLE supporters (
  supporter_id        INT IDENTITY(1,1) PRIMARY KEY,
  supporter_type      NVARCHAR(50)   NOT NULL,
  display_name        NVARCHAR(200)  NOT NULL,
  organization_name   NVARCHAR(200)  NULL,
  first_name          NVARCHAR(100)  NULL,
  last_name           NVARCHAR(100)  NULL,
  relationship_type   NVARCHAR(50)   NOT NULL,
  region              NVARCHAR(50)   NULL,
  country             NVARCHAR(100)  NULL,
  email               NVARCHAR(200)  NULL,
  phone               NVARCHAR(50)   NULL,
  status              NVARCHAR(20)   NOT NULL,
  first_donation_date NVARCHAR(20)   NULL,
  acquisition_channel NVARCHAR(50)   NULL,
  created_at          NVARCHAR(50)   NOT NULL DEFAULT (CONVERT(NVARCHAR(50), GETUTCDATE(), 120)),
  CONSTRAINT supporters_supporter_type_chk CHECK (supporter_type IN ('MonetaryDonor','InKindDonor','Volunteer','SkillsContributor','SocialMediaAdvocate','PartnerOrganization')),
  CONSTRAINT supporters_relationship_type_chk CHECK (relationship_type IN ('Local','International','PartnerOrganization')),
  CONSTRAINT supporters_status_chk CHECK (status IN ('Active','Inactive')),
  CONSTRAINT supporters_acquisition_channel_chk CHECK (acquisition_channel IS NULL OR acquisition_channel IN ('Website','SocialMedia','Event','WordOfMouth','PartnerReferral','Church'))
);

-- ── social_media_posts ──────────────────────────────────────
CREATE TABLE social_media_posts (
  post_id                        INT IDENTITY(1,1) PRIMARY KEY,
  platform                       NVARCHAR(50)   NOT NULL,
  platform_post_id               NVARCHAR(200)  NOT NULL,
  post_url                       NVARCHAR(500)  NULL,
  created_at                     NVARCHAR(50)   NOT NULL,
  day_of_week                    NVARCHAR(20)   NOT NULL,
  post_hour                      INT            NOT NULL CHECK (post_hour BETWEEN 0 AND 23),
  post_type                      NVARCHAR(50)   NOT NULL,
  media_type                     NVARCHAR(50)   NOT NULL,
  caption                        NVARCHAR(MAX)  NULL,
  hashtags                       NVARCHAR(MAX)  NULL,
  num_hashtags                   INT            NULL,
  mentions_count                 INT            NULL,
  has_call_to_action             INT            NOT NULL DEFAULT 0 CHECK (has_call_to_action IN (0,1)),
  call_to_action_type            NVARCHAR(50)   NULL,
  content_topic                  NVARCHAR(50)   NOT NULL,
  sentiment_tone                 NVARCHAR(50)   NOT NULL,
  caption_length                 INT            NULL,
  features_resident_story        INT            NOT NULL DEFAULT 0 CHECK (features_resident_story IN (0,1)),
  campaign_name                  NVARCHAR(200)  NULL,
  is_boosted                     INT            NOT NULL DEFAULT 0 CHECK (is_boosted IN (0,1)),
  boost_budget_php               DECIMAL(18,2)  NULL,
  impressions                    INT            NULL,
  reach                          INT            NULL,
  likes                          INT            NULL,
  comments                       INT            NULL,
  shares                         INT            NULL,
  saves                          INT            NULL,
  click_throughs                 INT            NULL,
  video_views                    INT            NULL,
  engagement_rate                DECIMAL(18,6)  NULL,
  profile_visits                 INT            NULL,
  donation_referrals             INT            NULL,
  estimated_donation_value_php   DECIMAL(18,2)  NULL,
  follower_count_at_post         INT            NULL,
  watch_time_seconds             INT            NULL,
  avg_view_duration_seconds      INT            NULL,
  subscriber_count_at_post       INT            NULL,
  forwards                       INT            NULL,
  CONSTRAINT social_media_posts_platform_chk CHECK (platform IN ('Facebook','Instagram','Twitter','TikTok','LinkedIn','YouTube','WhatsApp')),
  CONSTRAINT social_media_posts_post_type_chk CHECK (post_type IN ('ImpactStory','Campaign','EventPromotion','ThankYou','EducationalContent','FundraisingAppeal')),
  CONSTRAINT social_media_posts_media_type_chk CHECK (media_type IN ('Photo','Video','Carousel','Text','Reel')),
  CONSTRAINT social_media_posts_call_to_action_type_chk CHECK (call_to_action_type IS NULL OR call_to_action_type IN ('DonateNow','LearnMore','ShareStory','SignUp')),
  CONSTRAINT social_media_posts_content_topic_chk CHECK (content_topic IN ('Education','Health','Reintegration','DonorImpact','SafehouseLife','EventRecap','CampaignLaunch','Gratitude','AwarenessRaising')),
  CONSTRAINT social_media_posts_sentiment_tone_chk CHECK (sentiment_tone IN ('Hopeful','Urgent','Celebratory','Informative','Grateful','Emotional')),
  CONSTRAINT social_media_posts_platform_post_uk UNIQUE (platform, platform_post_id)
);

-- ── donations ───────────────────────────────────────────────
CREATE TABLE donations (
  donation_id           INT IDENTITY(1,1) PRIMARY KEY,
  supporter_id          INT            NOT NULL REFERENCES supporters(supporter_id),
  donation_type         NVARCHAR(50)   NOT NULL,
  donation_date         NVARCHAR(20)   NOT NULL,
  channel_source        NVARCHAR(50)   NOT NULL,
  currency_code         NVARCHAR(10)   NULL,
  amount                DECIMAL(18,2)  NULL,
  estimated_value       DECIMAL(18,2)  NULL,
  impact_unit           NVARCHAR(50)   NOT NULL,
  is_recurring          INT            NOT NULL DEFAULT 0 CHECK (is_recurring IN (0,1)),
  campaign_name         NVARCHAR(200)  NULL,
  notes                 NVARCHAR(MAX)  NULL,
  created_by_partner_id INT            NULL REFERENCES partners(partner_id),
  referral_post_id      INT            NULL REFERENCES social_media_posts(post_id),
  CONSTRAINT donations_donation_type_chk CHECK (donation_type IN ('Monetary','InKind','Time','Skills','SocialMedia')),
  CONSTRAINT donations_channel_source_chk CHECK (channel_source IN ('Campaign','Event','Direct','SocialMedia','PartnerReferral')),
  CONSTRAINT donations_impact_unit_chk CHECK (impact_unit IN ('pesos','items','hours','campaigns'))
);

-- ── in_kind_donation_items ──────────────────────────────────
CREATE TABLE in_kind_donation_items (
  item_id               INT IDENTITY(1,1) PRIMARY KEY,
  donation_id           INT            NOT NULL REFERENCES donations(donation_id) ON DELETE CASCADE,
  item_name             NVARCHAR(200)  NOT NULL,
  item_category         NVARCHAR(50)   NOT NULL,
  quantity              INT            NOT NULL,
  unit_of_measure       NVARCHAR(20)   NOT NULL,
  estimated_unit_value  DECIMAL(18,2)  NULL,
  intended_use          NVARCHAR(50)   NOT NULL,
  received_condition    NVARCHAR(20)   NOT NULL,
  CONSTRAINT in_kind_item_category_chk CHECK (item_category IN ('Food','Supplies','Clothing','SchoolMaterials','Hygiene','Furniture','Medical')),
  CONSTRAINT in_kind_uom_chk CHECK (unit_of_measure IN ('pcs','boxes','kg','sets','packs')),
  CONSTRAINT in_kind_intended_use_chk CHECK (intended_use IN ('Meals','Education','Shelter','Hygiene','Health')),
  CONSTRAINT in_kind_received_condition_chk CHECK (received_condition IN ('New','Good','Fair'))
);

-- ── donation_allocations ────────────────────────────────────
CREATE TABLE donation_allocations (
  allocation_id     INT IDENTITY(1,1) PRIMARY KEY,
  donation_id       INT            NOT NULL REFERENCES donations(donation_id) ON DELETE CASCADE,
  safehouse_id      INT            NOT NULL REFERENCES safehouses(safehouse_id),
  program_area      NVARCHAR(50)   NOT NULL,
  amount_allocated  DECIMAL(18,2)  NOT NULL,
  allocation_date   NVARCHAR(20)   NULL,
  allocation_notes  NVARCHAR(MAX)  NULL,
  CONSTRAINT donation_allocations_program_area_chk CHECK (program_area IN ('Education','Wellbeing','Operations','Transport','Maintenance','Outreach'))
);

-- ── residents ───────────────────────────────────────────────
CREATE TABLE residents (
  resident_id               INT IDENTITY(1,1) PRIMARY KEY,
  case_control_no           NVARCHAR(100)  NOT NULL,
  internal_code             NVARCHAR(100)  NOT NULL,
  safehouse_id              INT            NOT NULL REFERENCES safehouses(safehouse_id),
  case_status               NVARCHAR(20)   NOT NULL,
  sex                       NVARCHAR(5)    NOT NULL,
  date_of_birth             NVARCHAR(20)   NULL,
  birth_status              NVARCHAR(20)   NULL,
  place_of_birth            NVARCHAR(200)  NULL,
  religion                  NVARCHAR(100)  NULL,
  case_category             NVARCHAR(50)   NOT NULL,
  sub_cat_orphaned          INT            NOT NULL DEFAULT 0 CHECK (sub_cat_orphaned IN (0,1)),
  sub_cat_trafficked        INT            NOT NULL DEFAULT 0 CHECK (sub_cat_trafficked IN (0,1)),
  sub_cat_child_labor       INT            NOT NULL DEFAULT 0 CHECK (sub_cat_child_labor IN (0,1)),
  sub_cat_physical_abuse    INT            NOT NULL DEFAULT 0 CHECK (sub_cat_physical_abuse IN (0,1)),
  sub_cat_sexual_abuse      INT            NOT NULL DEFAULT 0 CHECK (sub_cat_sexual_abuse IN (0,1)),
  sub_cat_osaec             INT            NOT NULL DEFAULT 0 CHECK (sub_cat_osaec IN (0,1)),
  sub_cat_cicl              INT            NOT NULL DEFAULT 0 CHECK (sub_cat_cicl IN (0,1)),
  sub_cat_at_risk           INT            NOT NULL DEFAULT 0 CHECK (sub_cat_at_risk IN (0,1)),
  sub_cat_street_child      INT            NOT NULL DEFAULT 0 CHECK (sub_cat_street_child IN (0,1)),
  sub_cat_child_with_hiv    INT            NOT NULL DEFAULT 0 CHECK (sub_cat_child_with_hiv IN (0,1)),
  is_pwd                    INT            NOT NULL DEFAULT 0 CHECK (is_pwd IN (0,1)),
  pwd_type                  NVARCHAR(100)  NULL,
  has_special_needs         INT            NOT NULL DEFAULT 0 CHECK (has_special_needs IN (0,1)),
  special_needs_diagnosis   NVARCHAR(200)  NULL,
  family_is_4ps             INT            NOT NULL DEFAULT 0 CHECK (family_is_4ps IN (0,1)),
  family_solo_parent        INT            NOT NULL DEFAULT 0 CHECK (family_solo_parent IN (0,1)),
  family_indigenous         INT            NOT NULL DEFAULT 0 CHECK (family_indigenous IN (0,1)),
  family_parent_pwd         INT            NOT NULL DEFAULT 0 CHECK (family_parent_pwd IN (0,1)),
  family_informal_settler   INT            NOT NULL DEFAULT 0 CHECK (family_informal_settler IN (0,1)),
  date_of_admission         NVARCHAR(20)   NULL,
  age_upon_admission        NVARCHAR(50)   NULL,
  present_age               NVARCHAR(50)   NULL,
  length_of_stay            NVARCHAR(50)   NULL,
  referral_source           NVARCHAR(100)  NULL,
  referring_agency_person   NVARCHAR(200)  NULL,
  date_colb_registered      NVARCHAR(20)   NULL,
  date_colb_obtained        NVARCHAR(20)   NULL,
  assigned_social_worker    NVARCHAR(200)  NULL,
  initial_case_assessment   NVARCHAR(MAX)  NULL,
  date_case_study_prepared  NVARCHAR(20)   NULL,
  reintegration_type        NVARCHAR(100)  NULL,
  reintegration_status      NVARCHAR(50)   NULL,
  initial_risk_level        NVARCHAR(20)   NULL,
  current_risk_level        NVARCHAR(20)   NULL,
  date_enrolled             NVARCHAR(20)   NULL,
  date_closed               NVARCHAR(20)   NULL,
  created_at                NVARCHAR(50)   NOT NULL DEFAULT (CONVERT(NVARCHAR(50), GETUTCDATE(), 120)),
  notes_restricted          NVARCHAR(MAX)  NULL,
  CONSTRAINT residents_case_status_chk CHECK (case_status IN ('Active','Closed','Transferred')),
  CONSTRAINT residents_sex_chk CHECK (sex IN ('F')),
  CONSTRAINT residents_birth_status_chk CHECK (birth_status IS NULL OR birth_status IN ('Marital','Non-Marital')),
  CONSTRAINT residents_case_category_chk CHECK (case_category IN ('Abandoned','Foundling','Surrendered','Neglected')),
  CONSTRAINT residents_referral_source_chk CHECK (referral_source IS NULL OR referral_source IN ('Government Agency','NGO','Police','Self-Referral','Community','Court Order')),
  CONSTRAINT residents_reintegration_type_chk CHECK (reintegration_type IS NULL OR reintegration_type IN ('Family Reunification','Foster Care','Adoption (Domestic)','Adoption (Inter-Country)','Independent Living','None')),
  CONSTRAINT residents_reintegration_status_chk CHECK (reintegration_status IS NULL OR reintegration_status IN ('Not Started','In Progress','Completed','On Hold')),
  CONSTRAINT residents_initial_risk_level_chk CHECK (initial_risk_level IS NULL OR initial_risk_level IN ('Low','Medium','High','Critical')),
  CONSTRAINT residents_current_risk_level_chk CHECK (current_risk_level IS NULL OR current_risk_level IN ('Low','Medium','High','Critical')),
  CONSTRAINT residents_case_control_uk UNIQUE (case_control_no),
  CONSTRAINT residents_internal_code_uk UNIQUE (internal_code)
);

-- ── process_recordings ──────────────────────────────────────
CREATE TABLE process_recordings (
  recording_id              INT IDENTITY(1,1) PRIMARY KEY,
  resident_id               INT            NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  session_date              NVARCHAR(20)   NOT NULL,
  social_worker             NVARCHAR(200)  NULL,
  session_type              NVARCHAR(20)   NOT NULL,
  session_duration_minutes  INT            NULL,
  emotional_state_observed  NVARCHAR(50)   NULL,
  emotional_state_end       NVARCHAR(50)   NULL,
  session_narrative         NVARCHAR(MAX)  NULL,
  interventions_applied     NVARCHAR(MAX)  NULL,
  follow_up_actions         NVARCHAR(MAX)  NULL,
  progress_noted            INT            NOT NULL DEFAULT 0 CHECK (progress_noted IN (0,1)),
  concerns_flagged          INT            NOT NULL DEFAULT 0 CHECK (concerns_flagged IN (0,1)),
  referral_made             INT            NOT NULL DEFAULT 0 CHECK (referral_made IN (0,1)),
  notes_restricted          NVARCHAR(MAX)  NULL,
  CONSTRAINT process_recordings_session_type_chk CHECK (session_type IN ('Individual','Group')),
  CONSTRAINT process_recordings_emotional_state_obs_chk CHECK (emotional_state_observed IS NULL OR emotional_state_observed IN ('Calm','Anxious','Sad','Angry','Hopeful','Withdrawn','Happy','Distressed')),
  CONSTRAINT process_recordings_emotional_state_end_chk CHECK (emotional_state_end IS NULL OR emotional_state_end IN ('Calm','Anxious','Sad','Angry','Hopeful','Withdrawn','Happy','Distressed'))
);

-- ── home_visitations ────────────────────────────────────────
CREATE TABLE home_visitations (
  visitation_id             INT IDENTITY(1,1) PRIMARY KEY,
  resident_id               INT            NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  visit_date                NVARCHAR(20)   NOT NULL,
  social_worker             NVARCHAR(200)  NULL,
  visit_type                NVARCHAR(100)  NOT NULL,
  location_visited          NVARCHAR(200)  NULL,
  family_members_present    NVARCHAR(MAX)  NULL,
  purpose                   NVARCHAR(MAX)  NULL,
  observations              NVARCHAR(MAX)  NULL,
  family_cooperation_level  NVARCHAR(50)   NULL,
  safety_concerns_noted     INT            NOT NULL DEFAULT 0 CHECK (safety_concerns_noted IN (0,1)),
  follow_up_needed          INT            NOT NULL DEFAULT 0 CHECK (follow_up_needed IN (0,1)),
  follow_up_notes           NVARCHAR(MAX)  NULL,
  visit_outcome             NVARCHAR(50)   NULL,
  CONSTRAINT home_visitations_visit_type_chk CHECK (visit_type IN ('Initial Assessment','Routine Follow-Up','Reintegration Assessment','Post-Placement Monitoring','Emergency')),
  CONSTRAINT home_visitations_family_coop_chk CHECK (family_cooperation_level IS NULL OR family_cooperation_level IN ('Highly Cooperative','Cooperative','Neutral','Uncooperative')),
  CONSTRAINT home_visitations_visit_outcome_chk CHECK (visit_outcome IS NULL OR visit_outcome IN ('Favorable','Needs Improvement','Unfavorable','Inconclusive'))
);

-- ── education_records ───────────────────────────────────────
CREATE TABLE education_records (
  education_record_id  INT IDENTITY(1,1) PRIMARY KEY,
  resident_id          INT            NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  record_date          NVARCHAR(20)   NOT NULL,
  education_level      NVARCHAR(100)  NOT NULL,
  school_name          NVARCHAR(200)  NULL,
  enrollment_status    NVARCHAR(50)   NULL,
  attendance_rate      DECIMAL(18,4)  NULL,
  progress_percent     DECIMAL(18,4)  NULL,
  completion_status    NVARCHAR(50)   NOT NULL,
  notes                NVARCHAR(MAX)  NULL
);

-- ── health_wellbeing_records ────────────────────────────────
CREATE TABLE health_wellbeing_records (
  health_record_id           INT IDENTITY(1,1) PRIMARY KEY,
  resident_id                INT            NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  record_date                NVARCHAR(20)   NOT NULL,
  general_health_score       DECIMAL(18,4)  NULL,
  nutrition_score            DECIMAL(18,4)  NULL,
  sleep_quality_score        DECIMAL(18,4)  NULL,
  energy_level_score         DECIMAL(18,4)  NULL,
  height_cm                  DECIMAL(18,4)  NULL,
  weight_kg                  DECIMAL(18,4)  NULL,
  bmi                        DECIMAL(18,4)  NULL,
  medical_checkup_done       INT            NOT NULL DEFAULT 0 CHECK (medical_checkup_done IN (0,1)),
  dental_checkup_done        INT            NOT NULL DEFAULT 0 CHECK (dental_checkup_done IN (0,1)),
  psychological_checkup_done INT            NOT NULL DEFAULT 0 CHECK (psychological_checkup_done IN (0,1)),
  notes                      NVARCHAR(MAX)  NULL
);

-- ── intervention_plans ──────────────────────────────────────
CREATE TABLE intervention_plans (
  plan_id              INT IDENTITY(1,1) PRIMARY KEY,
  resident_id          INT            NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  plan_category        NVARCHAR(50)   NOT NULL,
  plan_description     NVARCHAR(MAX)  NOT NULL,
  services_provided    NVARCHAR(MAX)  NULL,
  target_value         DECIMAL(18,4)  NULL,
  target_date          NVARCHAR(20)   NULL,
  status               NVARCHAR(20)   NOT NULL,
  case_conference_date NVARCHAR(20)   NULL,
  created_at           NVARCHAR(50)   NOT NULL DEFAULT (CONVERT(NVARCHAR(50), GETUTCDATE(), 120)),
  updated_at           NVARCHAR(50)   NOT NULL DEFAULT (CONVERT(NVARCHAR(50), GETUTCDATE(), 120)),
  CONSTRAINT intervention_plans_category_chk CHECK (plan_category IN ('Safety','Psychosocial','Education','Physical Health','Legal','Reintegration')),
  CONSTRAINT intervention_plans_status_chk CHECK (status IN ('Open','In Progress','Achieved','On Hold','Closed'))
);

-- ── incident_reports ────────────────────────────────────────
CREATE TABLE incident_reports (
  incident_id        INT IDENTITY(1,1) PRIMARY KEY,
  resident_id        INT            NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  safehouse_id       INT            NOT NULL REFERENCES safehouses(safehouse_id),
  incident_date      NVARCHAR(20)   NOT NULL,
  incident_type      NVARCHAR(50)   NOT NULL,
  severity           NVARCHAR(20)   NOT NULL,
  description        NVARCHAR(MAX)  NULL,
  response_taken     NVARCHAR(MAX)  NULL,
  resolved           INT            NOT NULL DEFAULT 0 CHECK (resolved IN (0,1)),
  resolution_date    NVARCHAR(20)   NULL,
  reported_by        NVARCHAR(200)  NULL,
  follow_up_required INT            NOT NULL DEFAULT 0 CHECK (follow_up_required IN (0,1)),
  CONSTRAINT incident_reports_type_chk CHECK (incident_type IN ('Behavioral','Medical','Security','RunawayAttempt','SelfHarm','ConflictWithPeer','PropertyDamage')),
  CONSTRAINT incident_reports_severity_chk CHECK (severity IN ('Low','Medium','High'))
);

-- ── safehouse_monthly_metrics ───────────────────────────────
CREATE TABLE safehouse_monthly_metrics (
  metric_id                INT IDENTITY(1,1) PRIMARY KEY,
  safehouse_id             INT            NOT NULL REFERENCES safehouses(safehouse_id),
  month_start              NVARCHAR(20)   NOT NULL,
  month_end                NVARCHAR(20)   NOT NULL,
  active_residents         INT            NULL,
  avg_education_progress   DECIMAL(18,4)  NULL,
  avg_health_score         DECIMAL(18,4)  NULL,
  process_recording_count  INT            NULL,
  home_visitation_count    INT            NULL,
  incident_count           INT            NULL,
  notes                    NVARCHAR(MAX)  NULL,
  CONSTRAINT safehouse_monthly_metrics_month_uk UNIQUE (safehouse_id, month_start)
);

-- ── public_impact_snapshots ─────────────────────────────────
CREATE TABLE public_impact_snapshots (
  snapshot_id          INT IDENTITY(1,1) PRIMARY KEY,
  snapshot_date        NVARCHAR(20)   NOT NULL,
  headline             NVARCHAR(500)  NULL,
  summary_text         NVARCHAR(MAX)  NULL,
  metric_payload_json  NVARCHAR(MAX)  NULL,
  is_published         INT            NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
  published_at         NVARCHAR(50)   NULL,
  CONSTRAINT public_impact_snapshots_month_uk UNIQUE (snapshot_date)
);

-- ── users ───────────────────────────────────────────────────
CREATE TABLE users (
  user_id            INT IDENTITY(1,1) PRIMARY KEY,
  email              NVARCHAR(200)  NOT NULL,
  password_hash      NVARCHAR(MAX)  NOT NULL,
  role               NVARCHAR(20)   NOT NULL CHECK (role IN ('admin','donor')),
  first_name         NVARCHAR(100)  NULL,
  last_name          NVARCHAR(100)  NULL,
  organization_name  NVARCHAR(200)  NULL,
  phone              NVARCHAR(50)   NULL,
  country            NVARCHAR(100)  NULL,
  region             NVARCHAR(50)   NULL,
  relationship_type  NVARCHAR(50)   NULL,
  acquisition_channel NVARCHAR(50)  NULL,
  supporter_type     NVARCHAR(50)   NULL,
  created_at         NVARCHAR(50)   NULL DEFAULT (CONVERT(NVARCHAR(50), GETUTCDATE(), 120)),
  is_active          INT            NOT NULL DEFAULT 1,
  CONSTRAINT users_email_uk UNIQUE (email)
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_partner_assignments_partner_id   ON partner_assignments(partner_id);
CREATE INDEX idx_partner_assignments_safehouse_id ON partner_assignments(safehouse_id);
CREATE INDEX idx_donations_supporter_id           ON donations(supporter_id);
CREATE INDEX idx_donations_referral_post_id       ON donations(referral_post_id);
CREATE INDEX idx_in_kind_donation_items_donation  ON in_kind_donation_items(donation_id);
CREATE INDEX idx_donation_allocations_donation    ON donation_allocations(donation_id);
CREATE INDEX idx_donation_allocations_safehouse   ON donation_allocations(safehouse_id);
CREATE INDEX idx_residents_safehouse_id           ON residents(safehouse_id);
CREATE INDEX idx_process_recordings_resident_id   ON process_recordings(resident_id);
CREATE INDEX idx_home_visitations_resident_id     ON home_visitations(resident_id);
CREATE INDEX idx_education_records_resident_id    ON education_records(resident_id);
CREATE INDEX idx_health_records_resident_id       ON health_wellbeing_records(resident_id);
CREATE INDEX idx_intervention_plans_resident_id   ON intervention_plans(resident_id);
CREATE INDEX idx_incident_reports_resident_id     ON incident_reports(resident_id);
CREATE INDEX idx_incident_reports_safehouse_id    ON incident_reports(safehouse_id);
CREATE INDEX idx_safehouse_monthly_metrics_sh     ON safehouse_monthly_metrics(safehouse_id);
