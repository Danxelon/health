/**
 * Admin Control Center — Government Digital Health Platform (Jibon Rokkha).
 *
 * Route: /admin
 * Dedicated administrative dashboard for authorized Bangladesh Government health officials.
 * Permission Guard: Restricted strictly to accounts where `user.role === 'admin'`.
 * Official Administrator: showystore2026@gmail.com
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Home,
  LogOut,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";

interface PendingDoctor {
  id: string;
  name: string;
  nameBn: string;
  bmdc: string;
  specialty: string;
  specialtyBn: string;
  degrees: string;
  hospital: string;
  experience: number;
  phone: string;
  appliedAt: string;
  status: "pending" | "verified" | "rejected";
}

interface AdminHealthUpdate {
  id: string;
  title: string;
  titleBn: string;
  body: string;
  bodyBn: string;
  kind: "alert" | "campaign" | "notice";
  source: string;
  effectiveFrom: string;
  expiresAt: string;
}

interface AdminArticle {
  id: string;
  title: string;
  titleBn: string;
  doctorName: string;
  bmdc: string;
  specialty: string;
  publishedAt: string;
  views: number;
  status: "published" | "flagged";
}

interface AdminComplaint {
  id: string;
  ticketNo: string;
  subject: string;
  subjectBn: string;
  targetType: "doctor" | "donor" | "blood_bank" | "platform";
  targetName: string;
  severity: 1 | 2 | 3;
  status: "open" | "in_review" | "resolved";
  slaClock: string;
  slaHours: number;
  submittedBy: string;
  submittedAt: string;
  description: string;
  resolutionNote?: string;
}

const INITIAL_PENDING_DOCTORS: PendingDoctor[] = [
  {
    id: "doc-pend-1",
    name: "Dr. Sadia Afroze",
    nameBn: "ডা. সাদিয়া আফরোজ",
    bmdc: "BMDC-A-91021",
    specialty: "Gynecology & Obstetrics",
    specialtyBn: "স্ত্রী ও প্রসূতি রোগ",
    degrees: "MBBS, FCPS (Gynae & Obs)",
    hospital: "Dhaka Medical College Hospital",
    experience: 8,
    phone: "01723456781",
    appliedAt: "আজ, সকাল ৯:৩০",
    status: "pending",
  },
  {
    id: "doc-pend-2",
    name: "Dr. Tanvir Ahmed",
    nameBn: "ডা. তানভীর আহমেদ",
    bmdc: "BMDC-A-92144",
    specialty: "Cardiology",
    specialtyBn: "কার্ডিওলজি (হৃদরোগ)",
    degrees: "MBBS, MD (Cardiology)",
    hospital: "NICVD, Dhaka",
    experience: 12,
    phone: "01823456782",
    appliedAt: "আজ, সকাল ১১:১৫",
    status: "pending",
  },
  {
    id: "doc-pend-3",
    name: "Dr. Nusrat Jahan",
    nameBn: "ডা. নুসরাত জাহান",
    bmdc: "BMDC-A-93012",
    specialty: "Pediatrics",
    specialtyBn: "শিশু রোগ বিশেষজ্ঞ",
    degrees: "MBBS, DCH, FCPS",
    hospital: "Dhaka Shishu Hospital",
    experience: 6,
    phone: "01923456783",
    appliedAt: "গতকাল, বিকাল ৪:০০",
    status: "pending",
  },
  {
    id: "doc-pend-4",
    name: "Dr. Mahmudur Rahman",
    nameBn: "ডা. মাহমুদুর রহমান",
    bmdc: "BMDC-A-94185",
    specialty: "Internal Medicine",
    specialtyBn: "মেডিসিন বিশেষজ্ঞ",
    degrees: "MBBS, FCPS (Medicine)",
    hospital: "Sir Salimullah Medical College",
    experience: 10,
    phone: "01623456784",
    appliedAt: "গতকাল, সন্ধ্যা ৬:২০",
    status: "pending",
  },
  {
    id: "doc-pend-5",
    name: "Dr. Rehana Parvin",
    nameBn: "ডা. রেহানা পারভীন",
    bmdc: "BMDC-A-95301",
    specialty: "Orthopedics",
    specialtyBn: "অর্থোপেডিক সার্জারি",
    degrees: "MBBS, MS (Orthopedics)",
    hospital: "NITOR (Pongu Hospital), Dhaka",
    experience: 14,
    phone: "01712345671",
    appliedAt: "২ দিন আগে",
    status: "pending",
  },
  {
    id: "doc-pend-6",
    name: "Dr. Shahriar Kabir",
    nameBn: "ডা. শাহরিয়ার কবির",
    bmdc: "BMDC-A-96420",
    specialty: "Neurology",
    specialtyBn: "নিউরোমেডিসিন",
    degrees: "MBBS, MD (Neurology)",
    hospital: "NINS, Agargaon, Dhaka",
    experience: 9,
    phone: "01812345672",
    appliedAt: "২ দিন আগে",
    status: "pending",
  },
  {
    id: "doc-pend-7",
    name: "Dr. Farzana Yasmin",
    nameBn: "ডা. ফারজানা ইয়াসমিন",
    bmdc: "BMDC-A-97155",
    specialty: "Dermatology",
    specialtyBn: "চর্ম ও যৌন রোগ",
    degrees: "MBBS, DDV, FCPS",
    hospital: "BSMMU, Shahbag, Dhaka",
    experience: 7,
    phone: "01912345673",
    appliedAt: "৩ দিন আগে",
    status: "pending",
  },
  {
    id: "doc-pend-8",
    name: "Dr. Tariqul Islam",
    nameBn: "ডা. তারিকুল ইসলাম",
    bmdc: "BMDC-A-98234",
    specialty: "General Surgery",
    specialtyBn: "জেনারেল সার্জারি",
    degrees: "MBBS, FCPS (Surgery)",
    hospital: "Chittagong Medical College Hospital",
    experience: 15,
    phone: "01612345674",
    appliedAt: "৩ দিন আগে",
    status: "pending",
  },
  {
    id: "doc-pend-9",
    name: "Dr. Mehedi Hasan",
    nameBn: "ডা. মেহেদী হাসান",
    bmdc: "BMDC-A-89412",
    specialty: "Nephrology",
    specialtyBn: "কিডনি রোগ বিশেষজ্ঞ",
    degrees: "MBBS, MD (Nephrology)",
    hospital: "National Institute of Kidney Diseases",
    experience: 11,
    phone: "01734567891",
    appliedAt: "৪ দিন আগে",
    status: "pending",
  },
  {
    id: "doc-pend-10",
    name: "Dr. Sharmin Sultana",
    nameBn: "ডা. শারমিন সুলতানা",
    bmdc: "BMDC-A-90188",
    specialty: "Ophthalmology",
    specialtyBn: "চক্ষু বিশেষজ্ঞ",
    degrees: "MBBS, FCPS (Ophthalmology)",
    hospital: "National Institute of Ophthalmology",
    experience: 8,
    phone: "01834567892",
    appliedAt: "৪ দিন আগে",
    status: "pending",
  },
  {
    id: "doc-pend-11",
    name: "Dr. Kazi Moniruzzaman",
    nameBn: "ডা. কাজী মনিরুজ্জামান",
    bmdc: "BMDC-A-92841",
    specialty: "ENT & Head Neck Surgery",
    specialtyBn: "নাক, কান ও গলা বিশেষজ্ঞ",
    degrees: "MBBS, DLO, MS (ENT)",
    hospital: "Shaheed Suhrawardy Medical College",
    experience: 13,
    phone: "01934567893",
    appliedAt: "৫ দিন আগে",
    status: "pending",
  },
  {
    id: "doc-pend-12",
    name: "Dr. Anika Tabassum",
    nameBn: "ডা. আনিকা তাবাসসুম",
    bmdc: "BMDC-A-94762",
    specialty: "Hematology",
    specialtyBn: "রক্ত রোগ ও থ্যালাসেমিয়া",
    degrees: "MBBS, FCPS (Hematology)",
    hospital: "Dhaka Medical College Hospital",
    experience: 5,
    phone: "01634567894",
    appliedAt: "৫ দিন আগে",
    status: "pending",
  },
];

const INITIAL_VERIFIED_DOCTORS: PendingDoctor[] = [
  {
    id: "doc-ver-1",
    name: "Dr. M. A. Rahman",
    nameBn: "ডা. এম. এ. রহমান",
    bmdc: "BMDC-A-88101",
    specialty: "Cardiology",
    specialtyBn: "কার্ডিওলজি (হৃদরোগ)",
    degrees: "MBBS, FCPS (Cardiology), FACC",
    hospital: "National Heart Foundation, Dhaka",
    experience: 18,
    phone: "01711990001",
    appliedAt: "যাচাইকৃত: ১৫ জানুয়ারি ২০২৬",
    status: "verified",
  },
  {
    id: "doc-ver-2",
    name: "Dr. Fatima Begum",
    nameBn: "ডা. ফাতিমা বেগম",
    bmdc: "BMDC-A-88102",
    specialty: "Pediatrics",
    specialtyBn: "শিশু রোগ বিশেষজ্ঞ",
    degrees: "MBBS, MD (Pediatrics), FCPS",
    hospital: "Dhaka Shishu Hospital",
    experience: 14,
    phone: "01711990002",
    appliedAt: "যাচাইকৃত: ২০ জানুয়ারি ২০২৬",
    status: "verified",
  },
  {
    id: "doc-ver-3",
    name: "Dr. Anwar Hossain",
    nameBn: "ডা. আনোয়ার হোসেন",
    bmdc: "BMDC-A-88103",
    specialty: "Internal Medicine & Dengue",
    specialtyBn: "মেডিসিন ও ডেঙ্গু বিশেষজ্ঞ",
    degrees: "MBBS, FCPS (Internal Medicine)",
    hospital: "Kurmitola General Hospital",
    experience: 16,
    phone: "01711990003",
    appliedAt: "যাচাইকৃত: ১ ফেব্রুয়ারি ২০২৬",
    status: "verified",
  },
  {
    id: "doc-ver-4",
    name: "Dr. Taslima Akter",
    nameBn: "ডা. তাসলিমা আক্তার",
    bmdc: "BMDC-A-88104",
    specialty: "Gynecology & Obstetrics",
    specialtyBn: "স্ত্রী ও প্রসূতি রোগ বিশেষজ্ঞ",
    degrees: "MBBS, MS (Gynae & Obs), MRCOG",
    hospital: "Bangabandhu Sheikh Mujib Medical University",
    experience: 12,
    phone: "01711990004",
    appliedAt: "যাচাইকৃত: ১০ ফেব্রুয়ারি ২০২৬",
    status: "verified",
  },
  {
    id: "doc-ver-5",
    name: "Dr. Kamal Uddin",
    nameBn: "ডা. কামাল উদ্দিন",
    bmdc: "BMDC-A-88105",
    specialty: "Hematology & Blood Disorders",
    specialtyBn: "হেমাটোলজি ও রক্ত রোগ",
    degrees: "MBBS, FCPS (Hematology), MPhil",
    hospital: "Dhaka Medical College Hospital",
    experience: 20,
    phone: "01711990005",
    appliedAt: "যাচাইকৃত: ১৮ ফেব্রুয়ারি ২০২৬",
    status: "verified",
  },
  {
    id: "doc-ver-6",
    name: "Dr. Rashedul Islam",
    nameBn: "ডা. রাশেদুল ইসলাম",
    bmdc: "BMDC-A-88106",
    specialty: "Endocrinology & Diabetes",
    specialtyBn: "ডায়াবেটিস ও হরমোন বিশেষজ্ঞ",
    degrees: "MBBS, MD (Endocrinology)",
    hospital: "BIRDEM General Hospital",
    experience: 15,
    phone: "01711990006",
    appliedAt: "যাচাইকৃত: ১ মার্চ ২০২৬",
    status: "verified",
  },
];

const INITIAL_HEALTH_UPDATES: AdminHealthUpdate[] = [
  {
    id: "upd-1",
    title: "National Dengue Call-to-Action 2026",
    titleBn: "জাতীয় ডেঙ্গু প্রতিরোধ ও বিশেষ সতর্কতা ২০২৬",
    body: "All 64 district hospitals instructed to maintain 24/7 dedicated dengue corners. Platelet stocks and emergency NS1 testing are prioritized.",
    bodyBn: "সকল জেলা সদর হাসপাতালে ২৪/৭ ডেঙ্গু কর্নার সচল রাখতে স্বাস্থ্য অধিদপ্তরের বিশেষ নির্দেশনা। প্লাটিলেট মজুদ ও এনএস১ পরীক্ষা জোরদার করা হয়েছে।",
    kind: "alert",
    source: "DGHS",
    effectiveFrom: "সক্রিয় (Active Today)",
    expiresAt: "2026-11-30",
  },
  {
    id: "upd-2",
    title: "IEDCR Nipah Virus Precautionary Guidelines",
    titleBn: "আইইডিসিআর নিপাহ ভাইরাস প্রতিরোধ ও সুরক্ষা নির্দেশিকা",
    body: "Strict advisory against consuming raw date palm sap or partially eaten fruits. Report suspected fever and encephalitis immediately.",
    bodyBn: "কাঁচা খেজুরের রস পান বা বাদুড়ে খাওয়া ফল খাওয়া থেকে সম্পূর্ণ বিরত থাকুন। জ্বর ও স্নায়বিক লক্ষণ দেখা দিলে দ্রুত নিকটস্থ হাসপাতালে যোগাযোগ করুন।",
    kind: "alert",
    source: "IEDCR",
    effectiveFrom: "সক্রিয় (Active This Week)",
    expiresAt: "2026-12-15",
  },
  {
    id: "upd-3",
    title: "Nationwide Routine EPI Vaccination Drive",
    titleBn: "সারাদেশে সম্প্রসারিত টিকাদান কর্মসূচি (EPI) জোরদারকরণ",
    body: "Routine immunisation sessions resume across all 495 upazilas. Zero dose tracking active for infants and pregnant mothers.",
    bodyBn: "সকল উপজেলা স্বাস্থ্য কমপ্লেক্স এবং ইউনিয়ন স্বাস্থ্যকেন্দ্রে নিয়মিত ইপিআই টিকা প্রদান কার্যক্রম সম্পূর্ণ স্বাভাবিক রয়েছে।",
    kind: "campaign",
    source: "EPI",
    effectiveFrom: "চলমান (Ongoing)",
    expiresAt: "2026-12-31",
  },
  {
    id: "upd-4",
    title: "Severe Heatwave & Hydration Advisory",
    titleBn: "তীব্র তাপদাহে স্বাস্থ্যঝুঁকি ও পানিশূন্যতা রোধে সতর্কতা",
    body: "Outdoor workers and children should hydrate hourly and avoid midday sun from 12 PM to 3:30 PM. Heat stroke emergency lines active.",
    bodyBn: "খোলা স্থানে কর্মরত শ্রমিক ও শিশুদের পর্যাপ্ত খাবার পানি ও স্যালাইন পানের পরামর্শ। দুপুর ১২টা থেকে ৩:৩০টা পর্যন্ত কড়া রোদ এড়িয়ে চলুন।",
    kind: "notice",
    source: "BMD",
    effectiveFrom: "সক্রিয় (Active)",
    expiresAt: "2026-10-31",
  },
  {
    id: "upd-5",
    title: "Safe Blood Transfusion & Thalassaemia Screening",
    titleBn: "নিরাপদ রক্ত সঞ্চালন ও থ্যালাসেমিয়া সচেতনতা কর্মসূচি",
    body: "DGHS announces free pre-marital screening and blood safety audits at all approved divisional blood transfusion centres.",
    bodyBn: "সকল বিভাগীয় ব্লাড ব্যাংকে বাধ্যতামূলক ৫টি স্ক্রিনিং পরীক্ষা নিশ্চিতকরণ এবং বিবাহপূর্ব থ্যালাসেমিয়া স্ক্রিনিং কার্যক্রম শুরু।",
    kind: "campaign",
    source: "DGHS",
    effectiveFrom: "সক্রিয় (Active)",
    expiresAt: "2026-12-31",
  },
];

const INITIAL_ARTICLES: AdminArticle[] = [
  {
    id: "art-1",
    title: "7 Dengue Warning Signs You Must Not Ignore",
    titleBn: "ডেঙ্গুর ৭টি বিপদ চিহ্ন যা কখনোই অবহেলা করা যাবে না",
    doctorName: "Dr. Anwar Hossain",
    bmdc: "BMDC-A-88103",
    specialty: "Internal Medicine & Dengue",
    publishedAt: "গতকাল (Yesterday)",
    views: 4320,
    status: "published",
  },
  {
    id: "art-2",
    title: "Living with Thalassaemia: Why Regular Transfusion Matters",
    titleBn: "থ্যালাসেমিয়া নিয়ে বেঁচে থাকা: নিয়মিত রক্ত সঞ্চালন কেন জরুরি",
    doctorName: "Dr. Kamal Uddin",
    bmdc: "BMDC-A-88105",
    specialty: "Hematology & Blood",
    publishedAt: "৩ দিন আগে (3 days ago)",
    views: 2980,
    status: "published",
  },
  {
    id: "art-3",
    title: "High Blood Pressure: The Quiet Condition",
    titleBn: "উচ্চ রক্তচাপ: নীরব ঘাতক ও প্রতিরোধে করণীয়",
    doctorName: "Dr. M. A. Rahman",
    bmdc: "BMDC-A-88101",
    specialty: "Cardiology",
    publishedAt: "৫ দিন আগে (5 days ago)",
    views: 5120,
    status: "published",
  },
  {
    id: "art-4",
    title: "A Parent's Guide to a Child's Fever",
    titleBn: "শিশুর জ্বর: বাবা-মায়ের জন্য প্রয়োজনীয় চিকিৎসা নির্দেশিকা",
    doctorName: "Dr. Fatima Begum",
    bmdc: "BMDC-A-88102",
    specialty: "Pediatrics",
    publishedAt: "১ সপ্তাহ আগে (1 week ago)",
    views: 3840,
    status: "published",
  },
  {
    id: "art-5",
    title: "Emergency Antidotes in Snake Bites: What to Do in First Hour",
    titleBn: "সাপের কামড়ে জরুরি করণীয়: প্রথম এক ঘণ্টার গোল্ডেন টাইম",
    doctorName: "Dr. Anwar Hossain",
    bmdc: "BMDC-A-88103",
    specialty: "Internal Medicine",
    publishedAt: "২ সপ্তাহ আগে (2 weeks ago)",
    views: 6710,
    status: "published",
  },
  {
    id: "art-6",
    title: "Danger Signs in Pregnancy: When to Rush to Hospital",
    titleBn: "গর্ভাবস্থায় মারাত্মক বিপদ চিহ্ন: কখন তাৎক্ষণিক হাসপাতালে যাবেন",
    doctorName: "Dr. Taslima Akter",
    bmdc: "BMDC-A-88104",
    specialty: "Gynecology & Obstetrics",
    publishedAt: "২ সপ্তাহ আগে (2 weeks ago)",
    views: 4590,
    status: "published",
  },
];

const INITIAL_COMPLAINTS: AdminComplaint[] = [
  {
    id: "cmp-1",
    ticketNo: "JR-2026-0041",
    subject: "False donor contact reported in Mirpur area",
    subjectBn: "মিরপুর এলাকায় ভুয়া রক্তদাতা নম্বরের রিপোর্ট",
    targetType: "donor",
    targetName: "Donor Profile #D-842",
    severity: 2,
    status: "in_review",
    slaClock: "২ ঘণ্টা ৪০ মিনিট বাকি / 2h 40m remaining",
    slaHours: 72,
    submittedBy: "User 01711***201",
    submittedAt: "১ দিন আগে",
    description: "রক্তদাতা ফোন রিসিভ করে অসৌজন্যমূলক আচরণ করেন এবং রক্তের বিনিময়ে আর্থিক সুবিধা দাবি করেন।",
  },
  {
    id: "cmp-2",
    ticketNo: "JR-2026-0042",
    subject: "Delayed response for emergency A- blood request",
    subjectBn: "জরুরি এ নেগেটিভ (A-) রক্তের আবেদনে সাড়া দিতে বিলম্ব",
    targetType: "blood_bank",
    targetName: "Regional Blood Center",
    severity: 1,
    status: "open",
    slaClock: "৪৫ মিনিট বাকি (জরুরি SLA) / 45m remaining (Critical)",
    slaHours: 24,
    submittedBy: "User 01823***411",
    submittedAt: "২৩ ঘণ্টা আগে",
    description: "আইসিইউতে ভর্তি রোগীর জন্য রক্তের জরুরি ম্যাচিং নোটিফিকেশন পেতে দেরি হওয়ায় বিকল্প ব্যবস্থা করতে হয়েছে।",
  },
  {
    id: "cmp-3",
    ticketNo: "JR-2026-0043",
    subject: "Chamber schedule discrepancy at district hospital",
    subjectBn: "জেলা হাসপাতালের টেলিমেডিসিন চেম্বার সময়সূচি অমিল",
    targetType: "doctor",
    targetName: "Telemedicine Queue #T-104",
    severity: 3,
    status: "open",
    slaClock: "৬ ঘণ্টা ১৫ মিনিট বাকি / 6h 15m remaining",
    slaHours: 168,
    submittedBy: "User 01934***812",
    submittedAt: "২ দিন আগে",
    description: "অনলাইন কনসালটেশন অ্যাপয়েন্টমেন্ট নির্দিষ্ট সময়ে শুরু হয়নি এবং ৩০ মিনিট অপেক্ষার পর সংযোগ বিচ্ছিন্ন হয়।",
  },
];

export default function Admin() {
  const { lang } = useAppShell();
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<"doctors" | "updates" | "articles" | "complaints">("doctors");

  // Tab 1 Sub-view
  const [doctorView, setDoctorView] = useState<"pending" | "verified" | "rejected">("pending");

  // Reactive Data Stores
  const [pendingDoctors, setPendingDoctors] = useState<PendingDoctor[]>(INITIAL_PENDING_DOCTORS);
  const [verifiedDoctors, setVerifiedDoctors] = useState<PendingDoctor[]>(INITIAL_VERIFIED_DOCTORS);
  const [updates, setUpdates] = useState<AdminHealthUpdate[]>(INITIAL_HEALTH_UPDATES);
  const [articles, setArticles] = useState<AdminArticle[]>(INITIAL_ARTICLES);
  const [complaints, setComplaints] = useState<AdminComplaint[]>(INITIAL_COMPLAINTS);

  // Search filter
  const [doctorSearch, setDoctorSearch] = useState("");
  const [articleSearch, setArticleSearch] = useState("");

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for Health Bulletins
  const [newTitle, setNewTitle] = useState("");
  const [newTitleBn, setNewTitleBn] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newBodyBn, setNewBodyBn] = useState("");
  const [newSource, setNewSource] = useState("DGHS");
  const [newKind, setNewKind] = useState<"alert" | "campaign" | "notice">("alert");
  const [newExpiresAt, setNewExpiresAt] = useState("2026-12-31");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Permission Guard
  const isAdmin = isLoggedIn && user?.role === "admin";

  // 1. Unauthenticated or Non-Admin Screen
  if (!isAdmin) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-blood-soft/60 bg-surface p-8 sm:p-10 text-center shadow-2xl relative overflow-hidden">
          {/* Subtle watermark accent */}
          <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-blood-soft/30 blur-2xl pointer-events-none" />

          {/* Emblem & Shield Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blood-soft text-blood-deep shadow-inner border border-blood/20">
            <ShieldAlert className="h-10 w-10" strokeWidth={2.2} />
          </div>

          {/* Badge */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blood-soft px-3.5 py-1 text-xs font-black uppercase tracking-wider text-blood-deep">
            <Shield className="h-3.5 w-3.5" />
            <span>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</span>
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-ink tracking-tight">
            Access Denied / প্রশাসনিক প্রবেশাধিকার সংরক্ষিত
          </h1>

          <p className="mt-4 text-sm sm:text-[15px] text-muted leading-relaxed">
            {lang === "bn"
              ? "এই প্রশাসনিক নিয়ন্ত্রণ কেন্দ্র শুধুমাত্র বাংলাদেশ সরকারের স্বাস্থ্য অধিদপ্তর (DGHS) ও জাতীয় ডিজিটাল স্বাস্থ্য প্ল্যাটফর্মের অনুমোদিত কর্মকর্তাদের জন্য সংরক্ষিত। অননুমোদিত প্রবেশ আইনত দণ্ডনীয়।"
              : "This administrative control panel is strictly restricted to authorized government healthcare administrators. Only authorized personnel from the Ministry of Health and Family Welfare (MoHFW/DGHS) may access this system."}
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-elevated/70 p-4 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">অনুমোদিত অ্যাডমিন আইডি / Official Admin:</span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5">
                SECURE ROLE: ADMIN
              </span>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-brand select-all">
              showystore2026@gmail.com
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate("/login?next=/admin")}
              className="flex-1 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-md hover:bg-brand-deep hover:shadow-lg transition-all active:scale-98"
            >
              <span>লগইন করুন / Sign In as Admin</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              to="/"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 text-sm font-semibold text-ink hover:bg-elevated transition-colors"
            >
              <Home className="h-4 w-4 text-muted" />
              <span>ওয়েবসাইটে ফিরে যান / Live Site</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Handlers ---
  // Tab 1: Doctor Verification
  const handleApproveDoctor = (id: string) => {
    const doc = pendingDoctors.find((d) => d.id === id);
    if (!doc) return;

    setPendingDoctors((prev) => prev.filter((d) => d.id !== id));
    setVerifiedDoctors((prev) => [
      {
        ...doc,
        status: "verified",
        appliedAt: `যাচাইকৃত: ${new Date().toLocaleDateString("bn-BD")}`,
      },
      ...prev,
    ]);
    showToast(`ডাক্তার ${doc.nameBn} সফলভাবে অনুমোদিত হয়েছেন!`);
  };

  const handleRejectDoctor = (id: string) => {
    const doc = pendingDoctors.find((d) => d.id === id);
    if (!doc) return;

    setPendingDoctors((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "rejected" } : d))
    );
    showToast(`ডাক্তার ${doc.nameBn}-এর নিবন্ধন আবেদন প্রত্যাখ্যাত হয়েছে।`);
  };

  // Tab 2: Health Bulletins
  const handlePublishBulletin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() && !newTitleBn.trim()) return;

    const finalTitleBn = newTitleBn.trim() || newTitle.trim();
    const finalTitleEn = newTitle.trim() || newTitleBn.trim();
    const finalBodyBn = newBodyBn.trim() || newBody.trim();
    const finalBodyEn = newBody.trim() || newBodyBn.trim();

    const created: AdminHealthUpdate = {
      id: `upd-${Date.now()}`,
      title: finalTitleEn,
      titleBn: finalTitleBn,
      body: finalBodyEn,
      bodyBn: finalBodyBn,
      kind: newKind,
      source: newSource,
      effectiveFrom: "সক্রিয় (Just Now)",
      expiresAt: newExpiresAt || "2026-12-31",
    };

    setUpdates((prev) => [created, ...prev]);
    setNewTitle("");
    setNewTitleBn("");
    setNewBody("");
    setNewBodyBn("");
    showToast("জাতীয় স্বাস্থ্য বুলেটিন তাৎক্ষণিকভাবে প্রকাশিত হয়েছে!");
  };

  const handleDeleteBulletin = (id: string) => {
    const item = updates.find((u) => u.id === id);
    setUpdates((prev) => prev.filter((u) => u.id !== id));
    showToast(`বুলেটিন "${item ? item.titleBn : ""}" মুছে ফেলা হয়েছে।`);
  };

  // Tab 3: Articles Moderation
  const handleToggleFlagArticle = (id: string) => {
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const newStatus = a.status === "published" ? "flagged" : "published";
          showToast(
            newStatus === "flagged"
              ? "আর্টিকেলটি পাবলিক ফিড থেকে সাময়িক স্থগিত (Flagged) করা হয়েছে।"
              : "আর্টিকেলটি পুনরায় অনুমোদিত ও প্রকাশিত হয়েছে।"
          );
          return { ...a, status: newStatus };
        }
        return a;
      })
    );
  };

  // Tab 4: Complaints Resolution
  const handleResolveComplaint = (id: string) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          showToast(`অভিযোগ #${c.ticketNo} সফলভাবে সমাধান হিসেবে চিহ্নিত হয়েছে।`);
          return {
            ...c,
            status: "resolved",
            resolutionNote: "অ্যাডমিন তদন্ত সম্পন্ন ও অভিযোগ নিষ্পত্তি করা হয়েছে।",
          };
        }
        return c;
      })
    );
  };

  // Dynamic Counts for Stat Cards
  const pendingCount = pendingDoctors.filter((d) => d.status === "pending").length;
  const verifiedCount = 60 + (verifiedDoctors.length - INITIAL_VERIFIED_DOCTORS.length);
  const activeBulletinsCount = updates.length;
  const openComplaintsCount = complaints.filter((c) => c.status !== "resolved").length;

  // Filtered lists
  const currentPendingDoctors = pendingDoctors.filter((d) => {
    if (doctorView === "pending") return d.status === "pending";
    if (doctorView === "rejected") return d.status === "rejected";
    return true;
  });

  const displayDoctors = (doctorView === "verified" ? verifiedDoctors : currentPendingDoctors).filter(
    (d) =>
      d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      d.nameBn.includes(doctorSearch) ||
      d.bmdc.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      d.specialty.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      d.hospital.toLowerCase().includes(doctorSearch.toLowerCase())
  );

  const displayArticles = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(articleSearch.toLowerCase()) ||
      a.titleBn.includes(articleSearch) ||
      a.doctorName.toLowerCase().includes(articleSearch.toLowerCase()) ||
      a.bmdc.toLowerCase().includes(articleSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg text-ink pb-28">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-100 flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-900 text-white px-5 py-3.5 shadow-2xl animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/70 hover:text-white cursor-pointer"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Top Header Bar */}
      <header className="border-b border-line bg-surface/95 backdrop-blur-md sticky top-[4.5rem] z-30 shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Bangladesh Emblem / Shield badge & Title */}
            <div className="flex items-start sm:items-center gap-3.5">
              {/* Emblem / Shield Badge */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#006a4e] to-[#004d38] text-amber-300 shadow-md border border-amber-400/30">
                <ShieldCheck className="h-7 w-7" strokeWidth={2.2} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    গণপ্রজাতন্ত্রী বাংলাদেশ সরকার — জাতীয় ডিজিটাল স্বাস্থ্য প্ল্যাটফর্ম
                  </span>
                  <span className="rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5">
                    অফিসিয়াল পোর্টাল
                  </span>
                </div>

                <h1 className="mt-1 text-xl sm:text-2xl font-black text-ink tracking-tight flex items-center gap-2">
                  <span>প্রশাসনিক নিয়ন্ত্রণ কেন্দ্র / Admin Control Center</span>
                </h1>
              </div>
            </div>

            {/* Right: Admin email badge & Quick actions */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="rounded-xl border border-line bg-elevated px-3 py-1.5 text-right">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink justify-end">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span className="font-mono">showystore2026@gmail.com</span>
                </div>
                <div className="text-[11px] text-muted font-medium">
                  সিস্টেম অ্যাডমিনিস্ট্রেটর
                </div>
              </div>

              <Link
                to="/"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-bold text-ink hover:bg-elevated hover:border-line-strong transition-all shadow-2xs"
              >
                <Globe className="h-3.5 w-3.5 text-brand" />
                <span>ওয়েবসাইট দেখুন / Live Site</span>
              </Link>

              <button
                type="button"
                onClick={logout}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-blood-soft bg-blood-soft/60 px-3.5 text-xs font-bold text-blood-deep hover:bg-blood hover:text-white transition-all shadow-2xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>লগ আউট / Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-8">
        {/* 3. Metric Stat Cards (6 Cards) */}
        <section aria-label="Administrative Key Metrics">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Card 1: Total Donors */}
            <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-line-strong">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold">মোট রক্তদাতা</span>
                <div className="rounded-xl bg-blood-soft p-1.5 text-blood-deep">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-ink tnum">800+</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success">
                <TrendingUp className="h-3 w-3" />
                <span>৬৪ জেলায় নিবন্ধিত</span>
              </div>
            </div>

            {/* Card 2: Verified Doctors */}
            <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-line-strong">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold">যাচাইকৃত ডাক্তার</span>
                <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950 p-1.5 text-emerald-700 dark:text-emerald-300">
                  <UserCheck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400 tnum">
                {verifiedCount}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <Award className="h-3 w-3" />
                <span>BMDC অনুমোদিত</span>
              </div>
            </div>

            {/* Card 3: Pending Queue */}
            <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-line-strong">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold">অপেক্ষমান কিউ</span>
                <div className="rounded-xl bg-amber-100 dark:bg-amber-950 p-1.5 text-amber-700 dark:text-amber-300">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 tnum">
                {pendingCount}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                <span>যাচাইকরণ আবশ্যক</span>
              </div>
            </div>

            {/* Card 4: Active Blood Requests */}
            <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-line-strong">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold">সক্রিয় রক্তের আবেদন</span>
                <div className="rounded-xl bg-blood-soft p-1.5 text-blood-deep">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-blood-deep tnum">48</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-blood">
                <span className="h-2 w-2 rounded-full bg-blood animate-ping" />
                <span>লাইভ জরুরি আবেদন</span>
              </div>
            </div>

            {/* Card 5: Health Bulletins */}
            <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-line-strong">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold">স্বাস্থ্য বুলেটিন</span>
                <div className="rounded-xl bg-teal-100 dark:bg-teal-950 p-1.5 text-teal-700 dark:text-teal-300">
                  <Bell className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-teal-700 dark:text-teal-400 tnum">
                {activeBulletinsCount}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                <span>DGHS / IEDCR</span>
              </div>
            </div>

            {/* Card 6: Open Complaints */}
            <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs hover:border-line-strong">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold">অভিযোগ ও SLA</span>
                <div className="rounded-xl bg-rose-100 dark:bg-rose-950 p-1.5 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400 tnum">
                {openComplaintsCount}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                <span>SLA মনিটরে সক্রিয়</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Four Tabs / Workspaces */}
        <section className="mt-8">
          <div className="border-b border-line">
            <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto pb-px" aria-label="Admin Tabs">
              {/* Tab 1 */}
              <button
                type="button"
                onClick={() => setActiveTab("doctors")}
                className={`group pb-4 px-1 text-sm font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2.5 ${
                  activeTab === "doctors"
                    ? "border-brand text-brand-deep dark:text-brand"
                    : "border-transparent text-muted hover:text-ink hover:border-line"
                }`}
              >
                <Stethoscope className="h-4 w-4 shrink-0" />
                <span>ডাক্তার যাচাইকরণ (Doctor Verification)</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black tnum ${
                    activeTab === "doctors"
                      ? "bg-brand-soft text-brand-deep"
                      : "bg-elevated text-muted"
                  }`}
                >
                  {pendingCount}
                </span>
              </button>

              {/* Tab 2 */}
              <button
                type="button"
                onClick={() => setActiveTab("updates")}
                className={`group pb-4 px-1 text-sm font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2.5 ${
                  activeTab === "updates"
                    ? "border-brand text-brand-deep dark:text-brand"
                    : "border-transparent text-muted hover:text-ink hover:border-line"
                }`}
              >
                <Bell className="h-4 w-4 shrink-0" />
                <span>জাতীয় স্বাস্থ্য বুলেটিন (National Health Updates)</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black tnum ${
                    activeTab === "updates"
                      ? "bg-brand-soft text-brand-deep"
                      : "bg-elevated text-muted"
                  }`}
                >
                  {activeBulletinsCount}
                </span>
              </button>

              {/* Tab 3 */}
              <button
                type="button"
                onClick={() => setActiveTab("articles")}
                className={`group pb-4 px-1 text-sm font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2.5 ${
                  activeTab === "articles"
                    ? "border-brand text-brand-deep dark:text-brand"
                    : "border-transparent text-muted hover:text-ink hover:border-line"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>মেডিকেল আর্টিকেল নিয়ন্ত্রণ (Article Moderation)</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black tnum ${
                    activeTab === "articles"
                      ? "bg-brand-soft text-brand-deep"
                      : "bg-elevated text-muted"
                  }`}
                >
                  {articles.length}
                </span>
              </button>

              {/* Tab 4 */}
              <button
                type="button"
                onClick={() => setActiveTab("complaints")}
                className={`group pb-4 px-1 text-sm font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2.5 ${
                  activeTab === "complaints"
                    ? "border-brand text-brand-deep dark:text-brand"
                    : "border-transparent text-muted hover:text-ink hover:border-line"
                }`}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>অভিযোগ ও SLA মনিটর (Complaints & SLA)</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black tnum ${
                    activeTab === "complaints"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-elevated text-muted"
                  }`}
                >
                  {openComplaintsCount}
                </span>
              </button>
            </nav>
          </div>

          {/* ================================================================= */}
          {/* TAB 1: Doctor Verification                                        */}
          {/* ================================================================= */}
          {activeTab === "doctors" && (
            <div className="mt-6 space-y-6">
              {/* Header & Sub-Navigation */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-ink">
                    BMDC ডাক্তার যাচাইকরণ ও অনুমোদন কেন্দ্র
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    টেলিমেডিসিন সেবা ও প্রাতিষ্ঠানিক আর্টিকেল প্রকাশের জন্য বাংলাদেশ মেডিকেল ও ডেন্টাল কাউন্সিল (BMDC) অনুমোদন আবশ্যক।
                  </p>
                </div>

                {/* Sub-toggle and Search */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setDoctorView("pending")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        doctorView === "pending"
                          ? "bg-brand text-white shadow-xs"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      অপেক্ষমান ({pendingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoctorView("verified")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        doctorView === "verified"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      যাচাইকৃত ডাক্তার ({verifiedDoctors.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoctorView("rejected")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        doctorView === "rejected"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      প্রত্যাখ্যাত ({pendingDoctors.filter((d) => d.status === "rejected").length})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      placeholder="নাম, BMDC বা হাসপাতাল খুঁজুন…"
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      className="h-9 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-xs text-ink outline-none transition-colors focus:border-brand"
                    />
                  </div>
                </div>
              </div>

              {/* Doctors List */}
              <div className="space-y-3.5">
                {displayDoctors.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-surface p-12 text-center text-muted">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 opacity-60" />
                    <p className="mt-3 text-sm font-bold text-ink">কোনো ডাক্তার পাওয়া যায়নি</p>
                    <p className="text-xs text-muted">
                      {doctorView === "pending"
                        ? "বর্তমানে কোনো অপেক্ষমান আবেদন নেই। সকল আবেদন যাচাই সম্পন্ন!"
                        : "খোঁজের সাথে মিল রেখে কোনো ডাক্তার পাওয়া যায়নি।"}
                    </p>
                  </div>
                ) : (
                  displayDoctors.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-2xs transition-all hover:border-line-strong hover:shadow-xs"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        {/* Info details */}
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="font-black text-ink text-base sm:text-lg">
                              {lang === "bn" ? doc.nameBn : doc.name}
                            </h3>

                            {/* BMDC Reg Badge */}
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-0.5 text-xs font-black text-brand-deep border border-brand/20 select-all">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>{doc.bmdc}</span>
                            </span>

                            {/* Status Chip */}
                            {doc.status === "verified" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>যাচাইকৃত (BMDC Verified)</span>
                              </span>
                            ) : doc.status === "rejected" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-xs font-bold px-2.5 py-0.5">
                                <XCircle className="h-3.5 w-3.5" />
                                <span>প্রত্যাখ্যাত (Rejected)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold px-2.5 py-0.5 animate-pulse">
                                <Clock className="h-3.5 w-3.5" />
                                <span>অপেক্ষমান (Pending Verification)</span>
                              </span>
                            )}

                            <span className="text-[11px] text-muted">
                              আবেদন: {doc.appliedAt}
                            </span>
                          </div>

                          {/* Qualifications & Specialties */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                            <span className="font-semibold text-ink">
                              {doc.degrees}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-brand">
                              {lang === "bn" ? doc.specialtyBn : doc.specialty}
                            </span>
                            <span>•</span>
                            <span>
                              {doc.experience} বছরের অভিজ্ঞতা
                            </span>
                          </div>

                          {/* Hospital & Contact */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted" />
                              <span className="font-medium text-ink">{doc.hospital}</span>
                            </div>
                            <span>•</span>
                            <div>
                              <span>ফোন: </span>
                              <span className="font-mono text-ink font-semibold">{doc.phone}</span>
                            </div>
                            <span>•</span>
                            <span className="rounded bg-elevated px-2 py-0.5 text-[11px] text-muted font-medium">
                              BMDC সনদ যাচাইযোগ্য
                            </span>
                          </div>
                        </div>

                        {/* 1-Click Action Buttons */}
                        {doc.status === "pending" && (
                          <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-line">
                            <button
                              type="button"
                              onClick={() => handleApproveDoctor(doc.id)}
                              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
                            >
                              <Check className="h-4 w-4" />
                              <span>অনুমোদন করুন (Approve)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectDoctor(doc.id)}
                              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-rose-300 bg-surface px-4 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 transition-all active:scale-95"
                            >
                              <X className="h-4 w-4" />
                              <span>প্রত্যাখ্যান (Reject)</span>
                            </button>
                          </div>
                        )}

                        {doc.status === "verified" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-bold border border-emerald-200/50">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>সক্রিয় চিকিৎসক</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: National Health Updates                                    */}
          {/* ================================================================= */}
          {activeTab === "updates" && (
            <div className="mt-6 grid lg:grid-cols-12 gap-8">
              {/* Form to publish new government health alert/campaign/notice */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs sticky top-36">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-deep">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-ink text-base">
                        নতুন স্বাস্থ্য বুলেটিন প্রকাশ করুন
                      </h3>
                      <p className="text-[11px] text-muted">
                        DGHS, IEDCR, EPI বা আবহাওয়া অধিদপ্তরের পক্ষে প্রচার
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handlePublishBulletin} className="mt-5 space-y-4">
                    {/* Title EN & BN */}
                    <div>
                      <label className="block text-xs font-bold text-ink" htmlFor="bulletin-title-bn">
                        বুলেটিন শিরোনাম (বাংলা) *
                      </label>
                      <input
                        id="bulletin-title-bn"
                        type="text"
                        required
                        placeholder="উদাঃ ডেঙ্গু প্রতিরোধে জরুরি নির্দেশনা ২০২৬"
                        value={newTitleBn}
                        onChange={(e) => setNewTitleBn(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink" htmlFor="bulletin-title-en">
                        Bulletin Title (English) *
                      </label>
                      <input
                        id="bulletin-title-en"
                        type="text"
                        required
                        placeholder="e.g. National Dengue Warning & Hospital Directive"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
                      />
                    </div>

                    {/* Source & Kind */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-ink" htmlFor="bulletin-source">
                          উৎস (Source)
                        </label>
                        <select
                          id="bulletin-source"
                          value={newSource}
                          onChange={(e) => setNewSource(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
                        >
                          <option value="DGHS">DGHS (স্বাস্থ্য অধিদপ্তর)</option>
                          <option value="IEDCR">IEDCR (আইইডিসিআর)</option>
                          <option value="EPI">EPI (টিকাদান কর্মসূচি)</option>
                          <option value="BMD">BMD (আবহাওয়া অধিদপ্তর)</option>
                          <option value="MoHFW">MoHFW (স্বাস্থ্য মন্ত্রণালয়)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-ink" htmlFor="bulletin-kind">
                          ধরণ (Kind)
                        </label>
                        <select
                          id="bulletin-kind"
                          value={newKind}
                          onChange={(e) => setNewKind(e.target.value as "alert" | "campaign" | "notice")}
                          className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
                        >
                          <option value="alert">Alert (জরুরি সতর্কতা)</option>
                          <option value="campaign">Campaign (জাতীয় কর্মসূচি)</option>
                          <option value="notice">Notice (বিজ্ঞপ্তি)</option>
                        </select>
                      </div>
                    </div>

                    {/* Body BN & EN */}
                    <div>
                      <label className="block text-xs font-bold text-ink" htmlFor="bulletin-body-bn">
                        বিস্তারিত বিবরণ (বাংলা) *
                      </label>
                      <textarea
                        id="bulletin-body-bn"
                        rows={3}
                        required
                        placeholder="নাগরিকদের জন্য সরকারি নির্দেশনার বিস্তারিত বিবরণ…"
                        value={newBodyBn}
                        onChange={(e) => setNewBodyBn(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink" htmlFor="bulletin-body-en">
                        Details / Advisory Body (English)
                      </label>
                      <textarea
                        id="bulletin-body-en"
                        rows={2}
                        placeholder="Detailed advisory instructions for public awareness…"
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
                      />
                    </div>

                    {/* Expires At */}
                    <div>
                      <label className="block text-xs font-bold text-ink" htmlFor="bulletin-expires">
                        মেয়াদোত্তীর্ণ তারিখ (Expires At)
                      </label>
                      <div className="relative mt-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                        <input
                          id="bulletin-expires"
                          type="date"
                          value={newExpiresAt}
                          onChange={(e) => setNewExpiresAt(e.target.value)}
                          className="w-full rounded-xl border border-line bg-bg pl-9 pr-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-brand"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-6 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-brand-deep active:scale-98 transition-all"
                    >
                      <Bell className="h-4 w-4" />
                      <span>বুলেটিন প্রকাশ করুন (Publish Bulletin)</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* List of active bulletins with Delete / Deactivate action */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-ink text-base">
                      বর্তমানে সক্রিয় জাতীয় স্বাস্থ্য বুলেটিনসমূহ
                    </h3>
                    <p className="text-xs text-muted">
                      এই বুলেটিনগুলো প্রধান হোমপেজ ও পাবলিক ফিডে তাৎক্ষণিকভাবে প্রদর্শিত হচ্ছে।
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand-deep">
                    মোট: {updates.length}টি
                  </span>
                </div>

                <div className="space-y-3.5">
                  {updates.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-2xs space-y-3 transition-all hover:border-line-strong hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              item.kind === "alert"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : item.kind === "campaign"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}
                          >
                            {item.kind}
                          </span>

                          <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs font-bold text-ink">
                            {item.source}
                          </span>

                          <span className="text-[11px] text-muted">
                            • {item.effectiveFrom}
                          </span>

                          <span className="text-[11px] text-muted font-mono">
                            (মেয়াদ: {item.expiresAt})
                          </span>
                        </div>

                        {/* Delete / Deactivate Action */}
                        <button
                          type="button"
                          onClick={() => handleDeleteBulletin(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted hover:border-blood-soft hover:bg-blood-soft hover:text-blood-deep transition-all cursor-pointer"
                          title="Delete / Deactivate Bulletin"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>মুছে ফেলুন</span>
                        </button>
                      </div>

                      <div>
                        <h4 className="font-black text-ink text-base">
                          {lang === "bn" ? item.titleBn : item.title}
                        </h4>
                        <p className="mt-1 text-xs text-muted leading-relaxed">
                          {lang === "bn" ? item.bodyBn : item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: Medical Article Moderation                                 */}
          {/* ================================================================= */}
          {activeTab === "articles" && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-ink">
                    মেডিকেল আর্টিকেল নিয়ন্ত্রণ ও কনটেন্ট মডারেশন
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    শুধুমাত্র নিবন্ধিত ডাক্তারদের প্রকাশিত আর্টিকেল পাবলিক প্ল্যাটফর্মে প্রদর্শিত হয়। বিভ্রান্তিকর তথ্য রোধে তাৎক্ষণিক স্থগিতের সুবিধা রয়েছে।
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="আর্টিকেল শিরোনাম বা ডাক্তার খুঁজুন…"
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    className="h-9 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-xs text-ink outline-none transition-colors focus:border-brand"
                  />
                </div>
              </div>

              {/* Table of Articles */}
              <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-elevated/70 text-muted font-bold">
                    <tr>
                      <th className="px-5 py-3.5">আর্টিকেল শিরোনাম (Title)</th>
                      <th className="px-4 py-3.5">লেখক ও BMDC নম্বর</th>
                      <th className="px-4 py-3.5">প্রকাশের তারিখ</th>
                      <th className="px-4 py-3.5">ভিউ সংখ্যা</th>
                      <th className="px-4 py-3.5">স্ট্যাটাস (Status)</th>
                      <th className="px-5 py-3.5 text-right">নিয়ন্ত্রণ অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {displayArticles.map((art) => (
                      <tr key={art.id} className="hover:bg-elevated/40 transition-colors">
                        <td className="px-5 py-4 font-bold text-ink max-w-xs">
                          <div className="truncate text-sm">{art.titleBn}</div>
                          <div className="text-[11px] text-muted truncate">{art.title}</div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-semibold text-ink">{art.doctorName}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted">
                            <span className="font-mono text-brand font-medium">{art.bmdc}</span>
                            <span>• {art.specialty}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-muted whitespace-nowrap">
                          {art.publishedAt}
                        </td>

                        <td className="px-4 py-4 font-mono font-bold text-ink whitespace-nowrap">
                          {art.views.toLocaleString()} বার
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          {art.status === "published" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-0.5">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>প্রকাশিত (Published)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[11px] font-bold px-2.5 py-0.5">
                              <AlertCircle className="h-3 w-3" />
                              <span>স্থগিত (Flagged)</span>
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleFlagArticle(art.id)}
                            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-all shadow-2xs ${
                              art.status === "published"
                                ? "border border-rose-300 bg-surface text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                          >
                            {art.status === "published" ? (
                              <>
                                <ShieldAlert className="h-3.5 w-3.5" />
                                <span>স্থগিত করুন (Flag)</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>পুনরায় প্রকাশ (Unflag)</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: Complaints & SLA Monitor                                   */}
          {/* ================================================================= */}
          {activeTab === "complaints" && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-ink">
                    নাগরিক অভিযোগ ও SLA মনিটর (Grievance Redressal)
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    প্রতিটি নাগরিক অভিযোগ সরকারি SLA কাঠামোর অধীনে তাৎক্ষণিক ট্র্যাকিং ও মীমাংসা নিশ্চিত করা হয়।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-3 py-1 text-xs font-bold">
                    <Clock className="h-3.5 w-3.5" />
                    <span>খোলা অভিযোগ: {openComplaintsCount}টি</span>
                  </span>
                </div>
              </div>

              {/* Table of Grievances */}
              <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-elevated/70 text-muted font-bold">
                    <tr>
                      <th className="px-5 py-3.5">টিকেট নম্বর</th>
                      <th className="px-4 py-3.5">অভিযোগের লক্ষ্য (Target)</th>
                      <th className="px-5 py-3.5">বিবরণ (Subject & Details)</th>
                      <th className="px-4 py-3.5">তীব্রতা (Severity)</th>
                      <th className="px-4 py-3.5">SLA ক্লক (Time Left)</th>
                      <th className="px-4 py-3.5">স্ট্যাটাস</th>
                      <th className="px-5 py-3.5 text-right">মীমাংসা অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {complaints.map((cmp) => (
                      <tr key={cmp.id} className="hover:bg-elevated/40 transition-colors">
                        {/* Ticket */}
                        <td className="px-5 py-4 font-mono font-bold text-ink whitespace-nowrap">
                          <div>{cmp.ticketNo}</div>
                          <div className="text-[10px] text-muted font-sans">{cmp.submittedAt}</div>
                        </td>

                        {/* Target */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-black uppercase text-ink">
                            {cmp.targetType}
                          </span>
                          <div className="mt-1 text-[11px] text-muted font-medium">{cmp.targetName}</div>
                        </td>

                        {/* Subject & Description */}
                        <td className="px-5 py-4 max-w-sm">
                          <div className="font-bold text-ink">{cmp.subjectBn}</div>
                          <div className="text-[11px] text-muted line-clamp-2 mt-0.5">
                            {cmp.description}
                          </div>
                          <div className="mt-1 text-[10px] text-subtle">
                            অভিযোগকারী: {cmp.submittedBy}
                          </div>
                        </td>

                        {/* Severity */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {cmp.severity === 1 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 text-[11px] font-black">
                              <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                              জরুরি (২৪ ঘণ্টা)
                            </span>
                          ) : cmp.severity === 2 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-[11px] font-bold">
                              মধ্যম (৭২ ঘণ্টা)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 text-[11px] font-bold">
                              সাধারণ (১৬৮ ঘণ্টা)
                            </span>
                          )}
                        </td>

                        {/* SLA Clock */}
                        <td className="px-4 py-4 whitespace-nowrap font-medium">
                          {cmp.status === "resolved" ? (
                            <span className="text-emerald-600 font-bold">SLA সম্পন্ন</span>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-600 font-bold">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>{cmp.slaClock}</span>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {cmp.status === "resolved" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black px-2.5 py-0.5">
                              <CheckCircle2 className="h-3 w-3" />
                              মীমাংসিত (Resolved)
                            </span>
                          ) : cmp.status === "in_review" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-black px-2.5 py-0.5">
                              <Clock className="h-3 w-3" />
                              তদন্তাধীন (In Review)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-black px-2.5 py-0.5">
                              <AlertCircle className="h-3 w-3" />
                              উন্মুক্ত (Open)
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          {cmp.status !== "resolved" ? (
                            <button
                              type="button"
                              onClick={() => handleResolveComplaint(cmp.id)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 transition-all"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>সমাধান করুন (Resolve)</span>
                            </button>
                          ) : (
                            <span className="text-xs text-muted font-medium">নিস্পত্তি সম্পন্ন</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
