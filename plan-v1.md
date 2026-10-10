Generate a full-stack React and Supabase web application named "Jibon Rokkha", a comprehensive healthcare and blood donation platform for Bangladesh. 

TECH STACK:
- Frontend: React, Tailwind CSS (Targeting Vercel deployment)
- Backend/Database: Supabase (PostgreSQL)

PROJECT CONTEXT & VISION:
The app serves as a centralized health portal where citizens can find blood donors, read health articles, and consult doctors via telemedicine. The long-term vision is integration with the national NID database, but currently, it will use its own Supabase backend.

DATABASE SCHEMA REQUIREMENTS (Supabase SQL):
1. Users Table: Phone number, NID, blood group, present address, permanent address, live geolocation coords, profile info.
2. Doctors Table: Hierarchical location data (Upazila -> District -> Division -> National), medical certificates, BMDC registration, verification status.
3. Blood Requests Table: Requester info, required blood group, urgency, location, matching status.
4. Consultations/Telemedicine Table: Patient ID, Doctor ID, status, notes.
5. Articles/Blogs Table: Author (Doctor ID), title, content, timestamp.
6. Complaints Table: User ID, target (web/doctor/general), description.

AUTHENTICATION FLOW:
- Implement a custom login flow using Phone Number and NID.
- The system should simulate sending an OTP to the phone number for sign-in.

CORE FEATURES & LOGIC:
1. Blood Donor Search: When a user clicks "Find a donor", query the Supabase DB for matching blood info nearby. 
   - If a match is found: Display matched users nearby with their present/permanent address and a direct "Call" button.
   - If not found: Prompt the user with a 5-7 question form to input detailed blood/emergency info, auto-filling their existing personal data from auth.
2. Telemedicine (Consult a Doctor): Filter doctors based on live location (showing nearby Upazila/District doctors first) and disease specialty. Include UI stubs for "Message" and "Audio Call".
3. Content Portal: A feed displaying health updates and articles written by verified doctors.
4. Settings & Profile: Standard user profile management and a dedicated "Complain" form.

UI / UX & LAYOUT REQUIREMENTS (Tailwind CSS):
Create a modern, clean, medical-themed UI with the following layout structure:
- Left Sidebar: Top area for the Logo/Name, followed by Contact info (email, social links). Below that, a Menu containing: About us, Location, Dynamic Menu, Workforce, Contacts, Info, Language, Settings.
- Top Header: A wide search bar ("Search Anything") with a Filter button next to it.
- Main Middle Section: Prominent, clickable action buttons with both English and Bengali text: 
  * "Consult a doctor" (ডাক্তার খুঁজুন)
  * "Blood" (রক্ত)
  * "Donate Blood" (রক্তদান)
- Top Right Section: A "Blood banks near you" card with a map placeholder/graphic.
- Bottom Right Section: A full-height "Schedules & Nearby Blood Emergencies" pane (listing real-time requests like A+, O- with locations) that stretches to cover the bottom-right space.
- Bottom Left Section: "Articles" feed displaying blog posts from doctors.
- Registration Page: A beautifully decorated, healthcare-themed onboarding screen capturing initial NID, Phone, and basic user details.

Please provide the complete Supabase SQL schema setup first, followed by the complete React frontend code including routing, the main dashboard layout, and the core functional components.
