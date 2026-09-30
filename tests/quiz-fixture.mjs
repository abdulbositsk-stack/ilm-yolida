export const videoId = 'Nc7Oe_oDC58';
export const transcript = `Ilm olishda tartib va muntazamlik muhim. Har kuni ozgina o‘qish uzoq vaqt davomida bilimni mustahkamlaydi. Reja tuzishda aniq maqsad belgilanadi va unga erishish uchun kichik qadamlar tanlanadi. Ustoz murakkab mavzularni tushunishga yordam beradi, lekin o‘quvchi mustaqil mashq ham qilishi kerak. Savol berish tushunarsiz joylarni aniqlaydi. Xatolarni tahlil qilish keyingi urinishni yaxshilaydi. Yozib borilgan xulosalar takrorlash uchun tayanch bo‘ladi. Yangi bilimni amalda qo‘llash uning hayot bilan aloqasini ko‘rsatadi. Boshqalarga tushuntirish bilimdagi bo‘shliqlarni ochadi. Shuning uchun har bir mavzudan keyin o‘z so‘zlaringiz bilan qisqa xulosa yozing. Kitobni tugatishga shoshilishdan ko‘ra mazmunini anglashga e’tibor bering. Dam olish va uyqu ham o‘qish jarayonida muhim o‘rin tutadi. O‘rganilgan bilim bilan odob va mas’uliyat birga rivojlanishi kerak.`;
export function fixtureQuiz() {
  const stems = ['Muntazam o‘qish nimaga yordam beradi?', 'Rejada qanday qadamlar belgilanadi?', 'Ustozning yordami bilan birga nima kerak?', 'Savol berish nima uchun foydali?', 'Xatolar tahlili nimani yaxshilaydi?', 'Xulosalar qanday vazifani bajaradi?', 'Amaliyot bilimga qanday yordam beradi?', 'Boshqalarga tushuntirishning foydasi nima?'];
  return {
    usable: true, reason: '', title: 'Ilm olish va muntazamlik',
    questions: stems.map(question => ({ question, options: ['Bilimni mustahkamlashga', 'Vaqtni behuda sarflashga', 'Mashqni butunlay tashlashga', 'Faqat tez o‘qishga'], answer: 0, explanation: 'Muntazam harakat bilimni mustahkamlashga yordam beradi.', evidence: 'Har kuni ozgina o‘qish uzoq vaqt davomida bilimni mustahkamlaydi.' })),
    reflections: [{ question: 'Siz bilimni mustahkamlash uchun qaysi kichik odatni boshlaysiz?', guidance: 'Aniq vaqt va amaliy misol keltiring.' }, { question: 'Xatoni tahlil qilish sizga qachon yordam bergan?', guidance: 'Vaziyat va olgan sabog‘ingizni tushuntiring.' }]
  };
}
export function storedQuiz() { return { ...fixtureQuiz(), videoId, videoTitle: 'Test video', source: 'text', generatedAt: '2026-09-30T10:00:00.000Z' }; }
