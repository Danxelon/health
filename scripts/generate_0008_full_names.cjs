const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../supabase/migrations/0008_demo_seed.sql');
let content = fs.readFileSync(filePath, 'utf8');

const MALE_PREFIXES = [
  ['Md.', 'মো.'],
  ['Mohammad', 'মোহাম্মদ'],
  ['Kazi', 'কাজী'],
  ['Syed', 'সৈয়দ'],
  ['Chowdhury', 'চৌধুরী'],
  ['Khondokar', 'খন্দকার'],
  ['Sheikh', 'শেখ'],
  ['Mir', 'মীর'],
  ['Dewan', 'দেওয়ান'],
  ['Alhaj', 'আলহাজ্ব'],
];

const MALE_MIDDLES = [
  ['Rafiqul', 'রফিকুল'],
  ['Aminul', 'আমিনুল'],
  ['Mizanur', 'মিজানুর'],
  ['Ashraful', 'আশরাফুল'],
  ['Kamrul', 'কামরুল'],
  ['Tanvir', 'তানভীর'],
  ['Mahbubur', 'মাহবুবুর'],
  ['Saiful', 'সাইফুল'],
  ['Nazmul', 'নাজমুল'],
  ['Shahriar', 'শাহরিয়ার'],
  ['Jahangir', 'জাহাঙ্গীর'],
  ['Tariqul', 'তরিকুল'],
  ['Ziaur', 'জিয়াউর'],
  ['Monirul', 'মনিরুল'],
  ['Anisur', 'আনিসুর'],
  ['Shamsul', 'শামসুল'],
  ['Maksudur', 'মাকসুদুর'],
  ['Enamul', 'এনামুল'],
  ['Habibur', 'হাবিবুর'],
  ['Rezaul', 'রেজাউল'],
  ['Masudur', 'মাসুদুর'],
  ['Zillur', 'জিল্লুর'],
];

const MALE_SURNAMES = [
  ['Islam', 'ইসলাম'],
  ['Rahman', 'রহমান'],
  ['Hossain', 'হোসেন'],
  ['Ahmed', 'আহমেদ'],
  ['Chowdhury', 'চৌধুরী'],
  ['Hasan', 'হাসান'],
  ['Ali', 'আলী'],
  ['Khan', 'খান'],
  ['Sikder', 'শিকদার'],
  ['Talukder', 'তালুকদার'],
  ['Mollah', 'মোল্লা'],
  ['Sarkar', 'সরকার'],
  ['Haque', 'হক'],
  ['Munshi', 'মুন্সী'],
  ['Majumder', 'মজুমদার'],
  ['Bhuiyan', 'ভূঁইয়া'],
  ['Mahmud', 'মাহমুদ'],
];

const FEMALE_PREFIXES = [
  ['Syeda', 'সৈয়দা'],
  ['Begum', 'বেগম'],
  ['Mst.', 'মোছা.'],
  ['Kazi', 'কাজী'],
  ['Chowdhury', 'চৌধুরী'],
  ['Farhana', 'ফারহানা'],
  ['Nusrat', 'নুসরাত'],
  ['Tahmina', 'তাহমিনা'],
  ['Sharmin', 'শারমিন'],
];

const FEMALE_MIDDLES = [
  ['Farzana', 'ফারজানা'],
  ['Nusrat', 'নুসরাত'],
  ['Tasnim', 'তাসনিম'],
  ['Afroza', 'আফরোজা'],
  ['Jannatul', 'জান্নাতুল'],
  ['Sharmin', 'শারমিন'],
  ['Rehana', 'রেহানা'],
  ['Nasrin', 'নাসরিন'],
  ['Salma', 'সালমা'],
  ['Tahmina', 'তাহমিনা'],
  ['Kamrun', 'কামরুন'],
  ['Shirin', 'শিরিন'],
  ['Rokeya', 'রোকেয়া'],
  ['Fatema', 'ফাতেমা'],
  ['Sabina', 'সাবিনা'],
  ['Shamima', 'শামীমা'],
  ['Suraiya', 'সুরাইয়া'],
  ['Nahid', 'নাহিদ'],
  ['Rubina', 'রুবিনা'],
  ['Mahmuda', 'মাহমুদা'],
];

const FEMALE_SURNAMES = [
  ['Akter', 'আক্তার'],
  ['Begum', 'বেগম'],
  ['Khatun', 'খাতুন'],
  ['Sultana', 'সুলতানা'],
  ['Chowdhury', 'চৌধুরী'],
  ['Jahan', 'জাহান'],
  ['Parvin', 'পারভীন'],
  ['Islam', 'ইসলাম'],
  ['Rahman', 'রহমান'],
  ['Ahmed', 'আহমেদ'],
  ['Nahar', 'নাহার'],
];

function get3WordName(index, gender) {
  const isFemale = gender === 'female';
  const prefixes = isFemale ? FEMALE_PREFIXES : MALE_PREFIXES;
  const middles = isFemale ? FEMALE_MIDDLES : MALE_MIDDLES;
  const surnames = isFemale ? FEMALE_SURNAMES : MALE_SURNAMES;

  const p = prefixes[index % prefixes.length];
  const m = middles[(index * 7 + 3) % middles.length];
  const s = surnames[(index * 13 + 5) % surnames.length];

  return {
    en: `${p[0]} ${m[0]} ${s[0]}`,
    bn: `${p[1]} ${m[1]} ${s[1]}`,
  };
}

// 1. Update the 5 verified doctors
content = content.replace(
  /'Dr\. M\. A\. Rahman',\s*'ডা\. এম\. এ\. রহমান'/g,
  `'Dr. Mohammad Abdur Rahman', 'ডা. মোহাম্মদ আবদুর রহমান'`
);
content = content.replace(
  /'Dr\. Fatima Begum',\s*'ডা\. ফাতেমা বেগম'/g,
  `'Dr. Syeda Fatima Begum', 'ডা. সৈয়দা ফাতেমা বেগম'`
);
content = content.replace(
  /'Dr\. Anwar Hossain',\s*'ডা\. আনোয়ার হোসেন'/g,
  `'Dr. Mohammad Anwar Hossain', 'ডা. মোহাম্মদ আনোয়ার হোসেন'`
);
content = content.replace(
  /'Dr\. Taslima Akter',\s*'ডা\. তাসলিমা আক্তার'/g,
  `'Dr. Syeda Taslima Akter', 'ডা. সৈয়দা তাসলিমা আক্তার'`
);
content = content.replace(
  /'Dr\. Kamal Uddin',\s*'ডা\. কামাল উদ্দিন'/g,
  `'Dr. Mohammad Kamal Uddin', 'ডা. মোহাম্মদ কামাল উদ্দিন'`
);

// 2. Parse profiles section in 0008
const profilesHeader = `INSERT INTO profiles (id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, gender, blood_group, blood_group_verified, weight_kg, height_cm, home_upazila_id, permanent_upazila_id, present_address, permanent_address, home_geog, avatar_url, locale) VALUES`;

const parts = content.split(profilesHeader);
if (parts.length === 2) {
  const [before, after] = parts;
  // The VALUES section continues until the terminating semicolon
  const semiIndex = after.indexOf(';\n\n');
  const valuesText = after.slice(0, semiIndex);
  const remainder = after.slice(semiIndex);

  // Parse lines: ('uuid', 'role', 'name', 'name_bn', 'phone', ...)
  let profileIdx = 0;
  const updatedLines = valuesText.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('(')) return line;

    // Extract gender to generate suitable names
    const genderMatch = line.match(/'(male|female|other)'/);
    const gender = genderMatch ? genderMatch[1] : (profileIdx % 2 === 0 ? 'male' : 'female');

    const names = get3WordName(profileIdx++, gender);

    // Replace: ('<uuid>', '<role>', '<old_name>', <old_name_bn>, '<phone>',
    const regex = /^\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([^,]+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',/g;

    const replaced = line.replace(regex, (match, id, role, oldEn, oldBn, phone, nid, last4, dob) => {
      return `('${id}', '${role}', '${names.en}', '${names.bn}', '${phone}', '${nid}', '${last4}', '${dob}',`;
    });

    return replaced;
  });

  content = before + profilesHeader + updatedLines.join('\n') + remainder;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated 0008_demo_seed.sql with 3-word authentic full names in both English and Bengali!');
