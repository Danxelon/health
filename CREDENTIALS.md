# Medilink (মেডিলিঙ্ক) — System Credentials & Database Setup Guide

This document contains official authentication credentials for administrators, verified doctors, and test citizens/donors on the **Medilink (মেডিলিঙ্ক)** National Digital Health & Blood Network, along with instructions for executing the consolidated database setup script in Supabase.

---

## 1. Platform Administrator Account

The platform administrator possesses complete oversight of the Medilink national healthcare ecosystem: reviewing and verifying doctor BMDC credentials, issuing national health alerts and advisories (DGHS/IEDCR), moderating published medical articles, and managing citizen grievances and SLA resolution.

| Field | Value |
| :--- | :--- |
| **Email** | `showystore2026@gmail.com` |
| **Password** | `iloveyou` |
| **Role** | `admin` |
| **Full Name** | System Administrator (সিস্টেম অ্যাডমিনিস্ট্রেটর) |
| **Admin Panel URL** | [`/admin`](http://localhost:5173/admin) |
| **Key Privileges** | • Verify / Reject BMDC Doctor registrations<br>• Publish DGHS/IEDCR/EPI National Health Bulletins<br>• Moderate & approve medical articles<br>• Track citizen complaints, SLA deadlines & resolutions |

---

## 2. Verified Doctor Accounts (BMDC Registered)

> **Important**: In compliance with national health regulations and Medilink medical integrity policies, **only verified doctors** registered with the Bangladesh Medical and Dental Council (BMDC) can write and publish health articles or provide clinical consultations.

All public health consultations under the Medilink government portal are **100% Free** (বিনামূল্যে সরকারি সেবা). All doctors have their password set to `Doctor2026!`.

| Doctor Full Name (3-word EN & BN) | Email | Password | Phone | BMDC Reg No. | Specialty | Degrees & Hospital Affiliation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dr. Mohammad Abdur Rahman**<br>(ডা. মোহাম্মদ আবদুর রহমান) | `dr.rahman@health.gov.bd` | `Doctor2026!` | `01711990001` | `BMDC-A-88101` | **Cardiology**<br>(হৃদরোগ বিশেষজ্ঞ) | MBBS, FCPS, MD (Cardiology)<br>**NICVD**, Sher-e-Bangla Nagar, Dhaka | **Verified** ✅ |
| **Dr. Syeda Fatima Begum**<br>(ডা. সৈয়দা ফাতেমা বেগম) | `dr.fatima@health.gov.bd` | `Doctor2026!` | `01711990002` | `BMDC-A-88102` | **Pediatrics**<br>(শিশু রোগ বিশেষজ্ঞ) | MBBS, DCH, FCPS (Pediatrics)<br>**Dhaka Shishu Hospital**, Dhaka | **Verified** ✅ |
| **Dr. Mohammad Anwar Hossain**<br>(ডা. মোহাম্মদ আনোয়ার হোসেন) | `dr.anwar@health.gov.bd` | `Doctor2026!` | `01711990003` | `BMDC-A-88103` | **Internal Medicine & Dengue**<br>(মেডিসিন ও ডেঙ্গু বিশেষজ্ঞ) | MBBS, FCPS (Medicine)<br>**DMCH (Dhaka Medical College)**, Dhaka | **Verified** ✅ |
| **Dr. Syeda Taslima Akter**<br>(ডা. সৈয়দা তাসলিমা আক্তার) | `dr.taslima@health.gov.bd` | `Doctor2026!` | `01711990004` | `BMDC-A-88104` | **Gynecology & Obstetrics**<br>(স্ত্রী ও প্রসূতি রোগ বিশেষজ্ঞ) | MBBS, FCPS, MS (Gynae & Obs)<br>**Mitford Hospital**, Dhaka | **Verified** ✅ |
| **Dr. Mohammad Kamal Uddin**<br>(ডা. মোহাম্মদ কামাল উদ্দিন) | `dr.kamal@health.gov.bd` | `Doctor2026!` | `01711990005` | `BMDC-A-88105` | **Hematology & Blood**<br>(রক্তরোগ বিশেষজ্ঞ) | MBBS, MD (Hematology)<br>**BSMMU**, Shahbagh, Dhaka | **Verified** ✅ |

---

## 3. Citizen & Blood Donor Test Accounts

Citizens and blood donors authenticate via **Mobile Number + 6-digit OTP** (One-Time Password). In local development and demo mode, enter any pre-seeded mobile number with the default OTP code `123456`.

| Account Type | Sample 3-Word Name | Mobile Number | OTP Code | Blood Group | Date of Birth / Age | Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Citizen (Patient)** | **Mohammad Rafiqul Islam**<br>(মোহাম্মদ রফিকুল ইসলাম) | `01711000000` | `123456` | — | 1988-04-12 (38 yrs) | Search blood donors, submit emergency blood requests, consult doctors, live telemedicine chat & audio calls. |
| **Emergency Blood Donor** | **Tanvir Ahmed Chowdhury**<br>(তানভীর আহমেদ চৌধুরী) | `01812000001` | `123456` | `O+` (Positive) | 1995-08-20 (31 yrs) | Respond to blood emergency requests, log donation history, manage donor availability toggle. |
| **Donor (Rare Group)** | **Kazi Ashraful Haque**<br>(কাজী আশরাফুল হক) | `01913000002` | `123456` | `AB-` (Negative) | 1992-11-05 (33 yrs) | Emergency rare blood donor alerts and regional matching. |
| **Pre-seeded Citizen** | **Syeda Nusrat Jahan**<br>(সৈয়দা নুসরাত জাহান) | `01300000000` | `123456` | `B+` (Positive) | 1999-02-14 (27 yrs) | General patient health dashboard, appointment booking, article bookmarking. |

---

## 4. How to Execute `supabase/setup_database_medilink.sql` in Supabase SQL Editor

A consolidated, single-file database setup script is located in the repository root at:
`supabase/setup_database_medilink.sql`

This script is fully idempotent (`CREATE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) and performs a complete setup:
- Enables required PostgreSQL extensions: `pgcrypto` and `postgis`.
- Creates core tables: `profiles`, `upazilas`, `specialties`, `donors`, `doctors`, `consultations`, `blood_requests`, `articles`, `national_updates`, `complaints`, and audit logs.
- Adds `date_of_birth` and an automatic dynamic `age` calculation trigger (`trg_profiles_calculate_age`) that keeps age synchronized whenever date of birth is inserted or updated.
- Seeds the Administrator account (`showystore2026@gmail.com` / `iloveyou`).
- Seeds all 5 Verified Doctors with full 3-word names and BMDC registrations (`Doctor2026!`).
- Seeds 5 official DGHS/IEDCR/EPI national health updates and advisories.
- Seeds verified doctor medical articles (Dengue warning signs, Child fever, Pregnancy danger signs).
- Seeds sample blood donors with 3-word English and Bengali full names, DOB, age, geographic coordinates, and contact details.

### Step-by-Step Execution Guide:

1. **Open Supabase Dashboard:**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
   - Select your Medilink Supabase project.

2. **Open the SQL Editor:**
   - In the left sidebar navigation bar, click on the **SQL Editor** icon (`>_` icon).

3. **Create a New Query Snippet:**
   - Click the **"+ New Query"** button at the top (or click **"New query"** tab).

4. **Copy the SQL File Contents:**
   - Open the file [`supabase/setup_database_medilink.sql`](file:///H:/creativity/health/supabase/setup_database_medilink.sql) in your code editor.
   - Select the entire contents (`Ctrl + A` on Windows / `Cmd + A` on macOS) and copy (`Ctrl + C` / `Cmd + C`).

5. **Paste and Run in Supabase:**
   - Paste the code into the Supabase SQL Editor window (`Ctrl + V` / `Cmd + V`).
   - Click the green **"Run"** button in the bottom right (or press `Ctrl + Enter` / `Cmd + Enter`).
   - Wait 3–6 seconds for the script to finish executing.

6. **Confirm Successful Execution:**
   - The results pane at the bottom will display:
     `Success. No rows returned` (or query execution time).
   - Navigate to **Table Editor** on the left menu:
     - Check `profiles`: Confirm `date_of_birth` and `age` columns exist, and names are full 3-word names.
     - Check `doctors`: Confirm 5 verified records with BMDC numbers `BMDC-A-88101` through `BMDC-A-88105`.
     - Check `auth.users`: Confirm `showystore2026@gmail.com` and `dr.*@health.gov.bd` accounts are created.
     - Check `national_updates` and `articles`: Confirm data is present.

---

## 5. How to Log In & Test the Application

### A. Logging in as Administrator:
1. Navigate to [`/login`](http://localhost:5173/login).
2. Switch to the **"Admin / Doctor Login" (অ্যাডমিন ও ডাক্তার লগইন)** tab.
3. Enter:
   - **Email:** `showystore2026@gmail.com`
   - **Password:** `iloveyou`
   *(Or click the 1-click `[Admin Quick Fill]` badge on the login page).*
4. Click **Sign In**.
5. You will be automatically directed to the **Admin Dashboard** ([`/admin`](http://localhost:5173/admin)), where you can:
   - Review pending doctor BMDC registrations and approve/reject them with BMDC license verification.
   - Publish DGHS, IEDCR, and EPI National Health Bulletins.
   - Moderate and feature medical articles authored by verified doctors.
   - Monitor platform citizen complaints, SLA deadlines, and resolution statuses with a clean language switcher.

### B. Logging in as a Doctor:
1. Navigate to [`/login`](http://localhost:5173/login).
2. Switch to the **"Admin / Doctor Login"** tab.
3. Enter doctor credentials:
   - **Email:** `dr.rahman@health.gov.bd` (or any of the 5 doctors above)
   - **Password:** `Doctor2026!`
   *(Or click the 1-click `[Doctor Quick Fill]` badge on the login page).*
4. Click **Sign In**.
5. Doctors have access to:
   - Doctor profile and consultation requests.
   - Medical article creation and publishing portal at [`/articles/new`](http://localhost:5173/articles/new).
   - Telemedicine chat with patients.

### C. Logging in as Citizen / Blood Donor:
1. Navigate to [`/login`](http://localhost:5173/login).
2. In the **"Mobile OTP Login"** tab, enter phone number (e.g., `01711000000` or `01812000001`).
3. Enter OTP code `123456`.
4. You are now logged in to:
   - Search nearby blood donors with smart ring-radius distance sorting and bilingual display at [`/donors`](http://localhost:5173/donors).
   - Post emergency blood requests with blood group, hospital location, and urgency level at [`/requests/new`](http://localhost:5173/requests/new).
   - Browse verified BMDC doctors by specialty and request free consultations at [`/doctors`](http://localhost:5173/doctors).
