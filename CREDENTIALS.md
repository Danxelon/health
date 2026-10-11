# Jibon Rokkha (জীবন রক্ষা) — System Credentials & Access Guide

This document contains official authentication credentials for administrators, verified doctors, and test citizens/donors on the **Jibon Rokkha National Digital Health Platform**.

---

## 1. Platform Administrator Account

The platform administrator has complete oversight of the healthcare system: reviewing and verifying BMDC doctor credentials, issuing national health alerts and advisories (DGHS/IEDCR), moderating published medical content, and monitoring citizen grievances and platform SLA.

| Field | Value |
| :--- | :--- |
| **Email** | `showystore2026@gmail.com` |
| **Password** | `iloveyou` |
| **Role** | `admin` |
| **Full Name** | System Administrator (সিস্টেম অ্যাডমিনিস্ট্রেটর) |
| **Admin Panel URL** | [`/admin`](http://localhost:5173/admin) |
| **Key Privileges** | • Verify / Reject BMDC Doctors<br>• Publish DGHS/IEDCR National Health Bulletins<br>• Moderate Medical Articles<br>• Track System Complaints SLA & Resolution |

---

## 2. Verified Doctor Accounts (BMDC Registered)

> **Important**: In compliance with the platform medical integrity policy, **only verified doctors** registered with the Bangladesh Medical and Dental Council (BMDC) can write and publish health articles.

All consultations under the government portal are **100% Free** (বিনামূল্যে সরকারি সেবা).

| Doctor Name | Email | Password | Phone | BMDC Reg No. | Specialty | Degrees & Hospital | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dr. M. A. Rahman**<br>(ডা. এম. এ. রহমান) | `dr.rahman@health.gov.bd` | `Doctor2026!` | `01711990001` | `BMDC-A-88101` | **Cardiology**<br>(হৃদরোগ বিশেষজ্ঞ) | MBBS, FCPS, MD<br>NICVD, Dhaka | **Verified** ✅ |
| **Dr. Fatima Begum**<br>(ডা. ফাতেমা বেগম) | `dr.fatima@health.gov.bd` | `Doctor2026!` | `01711990002` | `BMDC-A-88102` | **Pediatrics**<br>(শিশু রোগ বিশেষজ্ঞ) | MBBS, DCH, FCPS<br>Dhaka Shishu Hospital | **Verified** ✅ |
| **Dr. Anwar Hossain**<br>(ডা. আনোয়ার হোসেন) | `dr.anwar@health.gov.bd` | `Doctor2026!` | `01711990003` | `BMDC-A-88103` | **Internal Medicine & Dengue**<br>(মেডিসিন ও ডেঙ্গু বিশেষজ্ঞ) | MBBS, FCPS<br>DMCH, Dhaka | **Verified** ✅ |
| **Dr. Taslima Akter**<br>(ডা. তাসলিমা আক্তার) | `dr.taslima@health.gov.bd` | `Doctor2026!` | `01711990004` | `BMDC-A-88104` | **Gynecology & Obstetrics**<br>(স্ত্রী ও প্রসূতি রোগ বিশেষজ্ঞ) | MBBS, FCPS, MS<br>Mitford Hospital, Dhaka | **Verified** ✅ |
| **Dr. Kamal Uddin**<br>(ডা. কামাল উদ্দিন) | `dr.kamal@health.gov.bd` | `Doctor2026!` | `01711990005` | `BMDC-A-88105` | **Hematology & Blood**<br>(রক্তরোগ বিশেষজ্ঞ) | MBBS, MD (Hematology)<br>BSMMU, Dhaka | **Verified** ✅ |

---

## 3. Citizen & Blood Donor Test Accounts

Citizens and blood donors authenticate via **Mobile Number + 6-digit OTP** (One-Time Password).

| Account Type | Mobile Number | OTP Code | Blood Group | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Citizen (Patient)** | `01711000000` | `123456` | — | Search donors, request emergency blood, consult doctors, live telemedicine chat & audio calls. |
| **Emergency Blood Donor** | `01812000001` | `123456` | `O+` (Positive) | Available for donation, respond to blood emergency calls, manage availability. |
| **Donor (Rare Group)** | `01913000002` | `123456` | `AB-` (Negative) | Emergency rare blood donor. |

---

## 4. How to Log In & Test

### A. Logging in as Administrator:
1. Navigate to [`/login`](http://localhost:5173/login).
2. Switch to the **"Admin / Doctor Login" (অ্যাডমিন ও ডাক্তার লগইন)** tab.
3. Enter:
   - **Email:** `showystore2026@gmail.com`
   - **Password:** `iloveyou`
   *(Or click the 1-click `[Admin Quick Fill]` badge).*
4. Click **Sign In**.
5. You will be automatically directed to the **Admin Dashboard** (`/admin`), where you can:
   - Review pending doctor BMDC registrations and approve/reject them.
   - Publish DGHS & IEDCR National Health Updates.
   - Moderate medical articles.
   - Monitor platform complaints and SLA response times.

### B. Logging in as Doctor:
1. Navigate to [`/login`](http://localhost:5173/login).
2. Switch to the **"Admin / Doctor Login"** tab.
3. Enter doctor credentials (e.g., `dr.rahman@health.gov.bd` / `Doctor2026!`).
4. Click **Sign In**.
5. Doctors have access to the **Doctor Portal** and can publish verified articles at [`/articles/new`](http://localhost:5173/articles/new).

### C. Logging in as Citizen / Donor:
1. Navigate to [`/login`](http://localhost:5173/login).
2. In the **"Mobile OTP Login"** tab, enter phone number (e.g., `01711000000`).
3. Enter OTP code `123456`.
4. You are now logged in to find blood donors, request blood, or consult doctors.
