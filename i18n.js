/* QUEENBEE — i18n.js : multilingual engine (English, اردو, العربية, हिन्दी, Español, Français) with full right-to-left layout.
   Every piece of interface text is translated in place (text, placeholders, titles); new screens are picked up automatically. */
(function () {
  'use strict';
  const N = window.Nova, cfg = N.cfg;
  const LANGS = { en: ['English', 'ltr'], ur: ['اردو', 'rtl'], ar: ['العربية', 'rtl'], hi: ['हिन्दी', 'ltr'], es: ['Español', 'ltr'], fr: ['Français', 'ltr'] };
  /* key (English) → [ur, ar, hi, es, fr] */
  const D = {
    'Log in': ['لاگ اِن', 'تسجيل الدخول', 'लॉग इन', 'Iniciar sesión', 'Se connecter'],
    'Sign up': ['سائن اپ', 'إنشاء حساب', 'साइन अप', 'Registrarse', 'S’inscrire'],
    'Sign up free': ['مفت سائن اپ', 'سجّل مجانًا', 'मुफ़्त साइन अप', 'Regístrate gratis', 'Inscription gratuite'],
    'Email': ['ای میل', 'البريد', 'ईमेल', 'Correo', 'E-mail'],
    'Phone': ['فون', 'الهاتف', 'फ़ोन', 'Teléfono', 'Téléphone'],
    'Welcome back 👋': ['خوش آمدید 👋', 'مرحبًا بعودتك 👋', 'वापसी पर स्वागत है 👋', 'Bienvenido de nuevo 👋', 'Bon retour 👋'],
    'Create your account': ['اپنا اکاؤنٹ بنائیں', 'أنشئ حسابك', 'अपना खाता बनाएँ', 'Crea tu cuenta', 'Créez votre compte'],
    'Log in to continue your conversations.': ['اپنی گفتگو جاری رکھنے کے لیے لاگ اِن کریں۔', 'سجّل الدخول لمتابعة محادثاتك.', 'अपनी बातचीत जारी रखने के लिए लॉग इन करें।', 'Inicia sesión para continuar tus conversaciones.', 'Connectez-vous pour continuer vos conversations.'],
    'Add your picture and details to join QueenB.Chat.': ['QueenB.Chat میں شامل ہونے کے لیے تصویر اور تفصیلات شامل کریں۔', 'أضف صورتك وبياناتك للانضمام إلى QueenB.Chat.', 'QueenB.Chat से जुड़ने के लिए फ़ोटो और जानकारी जोड़ें।', 'Añade tu foto y tus datos para unirte a QueenB.Chat.', 'Ajoutez votre photo et vos infos pour rejoindre QueenB.Chat.'],
    'Email address': ['ای میل ایڈریس', 'عنوان البريد الإلكتروني', 'ईमेल पता', 'Correo electrónico', 'Adresse e-mail'],
    'Password (min 6 characters)': ['پاس ورڈ (کم از کم 6 حروف)', 'كلمة المرور (6 أحرف على الأقل)', 'पासवर्ड (कम से कम 6 अक्षर)', 'Contraseña (mín. 6 caracteres)', 'Mot de passe (6 caractères min.)'],
    'Username (3–20 letters, numbers, _ .)': ['صارف نام (3–20 حروف، اعداد، _ .)', 'اسم المستخدم (3–20 حرفًا أو رقمًا، _ .)', 'यूज़रनेम (3–20 अक्षर, अंक, _ .)', 'Usuario (3–20 letras, números, _ .)', 'Nom d’utilisateur (3–20 lettres, chiffres, _ .)'],
    'Nickname (optional)': ['عرفی نام (اختیاری)', 'اللقب (اختياري)', 'उपनाम (वैकल्पिक)', 'Apodo (opcional)', 'Surnom (facultatif)'],
    'Username': ['صارف نام', 'اسم المستخدم', 'यूज़रनेम', 'Usuario', 'Nom d’utilisateur'],
    'Upload photo': ['تصویر اپ لوڈ کریں', 'رفع صورة', 'फ़ोटो अपलोड करें', 'Subir foto', 'Importer une photo'],
    'Make avatar': ['اوتار بنائیں', 'اصنع أفاتارك', 'अवतार बनाएँ', 'Crear avatar', 'Créer un avatar'],
    'Create account': ['اکاؤنٹ بنائیں', 'إنشاء الحساب', 'खाता बनाएँ', 'Crear cuenta', 'Créer le compte'],
    'Continue with Google': ['گوگل کے ساتھ جاری رکھیں', 'المتابعة باستخدام Google', 'Google से जारी रखें', 'Continuar con Google', 'Continuer avec Google'],
    'Join with your number': ['اپنے نمبر سے شامل ہوں', 'انضم برقمك', 'अपने नंबर से जुड़ें', 'Únete con tu número', 'Rejoignez avec votre numéro'],
    'Log in with your number': ['اپنے نمبر سے لاگ اِن کریں', 'سجّل الدخول برقمك', 'अपने नंबर से लॉग इन करें', 'Entra con tu número', 'Connectez-vous avec votre numéro'],
    'Phone number': ['فون نمبر', 'رقم الهاتف', 'फ़ोन नंबर', 'Número de teléfono', 'Numéro de téléphone'],
    'Send code →': ['کوڈ بھیجیں ←', 'إرسال الرمز ←', 'कोड भेजें →', 'Enviar código →', 'Envoyer le code →'],
    'Verify & continue →': ['تصدیق کریں اور آگے بڑھیں ←', 'تحقق وتابع ←', 'सत्यापित करें और आगे बढ़ें →', 'Verificar y continuar →', 'Vérifier et continuer →'],
    'Resend code': ['کوڈ دوبارہ بھیجیں', 'إعادة إرسال الرمز', 'कोड दोबारा भेजें', 'Reenviar código', 'Renvoyer le code'],
    '← Change number': ['← نمبر تبدیل کریں', '→ تغيير الرقم', '← नंबर बदलें', '← Cambiar número', '← Changer de numéro'],
    'Search or start a new chat': ['تلاش کریں یا نئی چیٹ شروع کریں', 'ابحث أو ابدأ محادثة جديدة', 'खोजें या नई चैट शुरू करें', 'Busca o inicia un chat', 'Rechercher ou démarrer un chat'],
    'Search…': ['تلاش…', 'بحث…', 'खोजें…', 'Buscar…', 'Rechercher…'],
    'Chats': ['چیٹس', 'المحادثات', 'चैट', 'Chats', 'Discussions'],
    'Status': ['اسٹیٹس', 'الحالة', 'स्टेटस', 'Estados', 'Statuts'],
    'Calls': ['کالز', 'المكالمات', 'कॉल', 'Llamadas', 'Appels'],
    'All': ['سب', 'الكل', 'सभी', 'Todos', 'Tous'],
    'Unread': ['غیر پڑھے', 'غير مقروءة', 'अपठित', 'No leídos', 'Non lus'],
    'Favorites': ['پسندیدہ', 'المفضلة', 'पसंदीदा', 'Favoritos', 'Favoris'],
    'Groups': ['گروپس', 'المجموعات', 'समूह', 'Grupos', 'Groupes'],
    'Type a message': ['پیغام لکھیں', 'اكتب رسالة', 'संदेश लिखें', 'Escribe un mensaje', 'Écrire un message'],
    'Settings': ['ترتیبات', 'الإعدادات', 'सेटिंग्स', 'Ajustes', 'Paramètres'],
    'Edit profile': ['پروفائل میں ترمیم', 'تعديل الملف', 'प्रोफ़ाइल संपादित करें', 'Editar perfil', 'Modifier le profil'],
    'Log out': ['لاگ آؤٹ', 'تسجيل الخروج', 'लॉग आउट', 'Cerrar sesión', 'Se déconnecter'],
    'New call': ['نئی کال', 'مكالمة جديدة', 'नई कॉल', 'Nueva llamada', 'Nouvel appel'],
    'Test microphone': ['مائیکروفون ٹیسٹ', 'اختبار الميكروفون', 'माइक्रोफ़ोन जाँचें', 'Probar micrófono', 'Tester le micro'],
    'Microphone check': ['مائیکروفون کی جانچ', 'فحص الميكروفون', 'माइक्रोफ़ोन जाँच', 'Prueba de micrófono', 'Test du micro'],
    'Start call': ['کال شروع کریں', 'ابدأ المكالمة', 'कॉल शुरू करें', 'Iniciar llamada', 'Démarrer l’appel'],
    'Done': ['مکمل', 'تم', 'हो गया', 'Listo', 'Terminé'],
    'Cancel': ['منسوخ', 'إلغاء', 'रद्द करें', 'Cancelar', 'Annuler'],
    'Save': ['محفوظ کریں', 'حفظ', 'सहेजें', 'Guardar', 'Enregistrer'],
    'Language': ['زبان', 'اللغة', 'भाषा', 'Idioma', 'Langue'],
    'Appearance': ['ظاہری شکل', 'المظهر', 'दिखावट', 'Apariencia', 'Apparence'],
    'Dark mode': ['ڈارک موڈ', 'الوضع الداكن', 'डार्क मोड', 'Modo oscuro', 'Mode sombre'],
    'Appearance — font and text size': ['ظاہری شکل — فونٹ اور تحریر کا سائز', 'المظهر — الخط وحجم النص', 'रूप — फ़ॉन्ट और टेक्स्ट आकार', 'Apariencia — fuente y tamaño del texto', 'Apparence — police et taille du texte'],
    'Small': ['چھوٹا', 'صغير', 'छोटा', 'Pequeño', 'Petit'], 'Medium': ['درمیانہ', 'متوسط', 'मध्यम', 'Mediano', 'Moyen'], 'Large': ['بڑا', 'كبير', 'बड़ा', 'Grande', 'Grand'], 'Extra large': ['بہت بڑا', 'كبير جدًا', 'बहुत बड़ा', 'Muy grande', 'Très grand'],
    'Sounds': ['آوازیں', 'الأصوات', 'ध्वनियाँ', 'Sonidos', 'Sons'],
    'Privacy': ['رازداری', 'الخصوصية', 'गोपनीयता', 'Privacidad', 'Confidentialité'],
    'Do Not Disturb': ['ڈسٹرب نہ کریں', 'عدم الإزعاج', 'परेशान न करें', 'No molestar', 'Ne pas déranger'],
    'Incoming voice call…': ['آنے والی صوتی کال…', 'مكالمة صوتية واردة…', 'आने वाली वॉइस कॉल…', 'Llamada de voz entrante…', 'Appel vocal entrant…'],
    'Ringing…': ['گھنٹی بج رہی ہے…', 'يرن…', 'रिंग हो रहा है…', 'Sonando…', 'Ça sonne…'],
    'Connected': ['منسلک', 'متصل', 'जुड़ गया', 'Conectado', 'Connecté'],
    'Call back': ['واپس کال کریں', 'معاودة الاتصال', 'वापस कॉल करें', 'Devolver llamada', 'Rappeler'],
    'Typing…': ['لکھ رہا ہے…', 'يكتب…', 'लिख रहा है…', 'Escribiendo…', 'Écrit…'],
    'online': ['آن لائن', 'متصل', 'ऑनलाइन', 'en línea', 'en ligne'],
    'New chat': ['نئی چیٹ', 'محادثة جديدة', 'नई चैट', 'Nuevo chat', 'Nouvelle discussion'],
    'New group': ['نیا گروپ', 'مجموعة جديدة', 'नया समूह', 'Nuevo grupo', 'Nouveau groupe'],
    'Blocked users': ['بلاک کیے گئے', 'المستخدمون المحظورون', 'ब्लॉक किए गए', 'Usuarios bloqueados', 'Utilisateurs bloqués'],
    'Mute': ['خاموش', 'كتم', 'म्यूट', 'Silenciar', 'Muet'],
    'Delete': ['حذف کریں', 'حذف', 'हटाएँ', 'Eliminar', 'Supprimer'],
    'Reply': ['جواب دیں', 'رد', 'जवाब दें', 'Responder', 'Répondre'],
    'Forward': ['آگے بھیجیں', 'إعادة توجيه', 'फ़ॉरवर्ड', 'Reenviar', 'Transférer'],
    'Copy': ['کاپی', 'نسخ', 'कॉपी', 'Copiar', 'Copier'],
    'Pin': ['پن کریں', 'تثبيت', 'पिन करें', 'Fijar', 'Épingler'],
    'Search': ['تلاش', 'بحث', 'खोज', 'Buscar', 'Rechercher'],
    'Message': ['پیغام', 'رسالة', 'संदेश', 'Mensaje', 'Message'],
    'Contact info': ['رابطے کی معلومات', 'معلومات جهة الاتصال', 'संपर्क जानकारी', 'Info del contacto', 'Infos du contact'],
    'Group info': ['گروپ کی معلومات', 'معلومات المجموعة', 'समूह जानकारी', 'Info del grupo', 'Infos du groupe'],
    'Recent': ['حالیہ', 'الأخيرة', 'हाल के', 'Recientes', 'Récents'],
    'Ask QueenB.Chat AI': ['QueenB.Chat AI سے پوچھیں', 'اسأل QueenB.Chat AI', 'QueenB.Chat AI से पूछें', 'Pregunta a QueenB.Chat AI', 'Demandez à QueenB.Chat AI'],
    'Catch up': ['خلاصہ دیکھیں', 'ملخص سريع', 'सारांश देखें', 'Ponerse al día', 'Résumé rapide'],
    'Polls': ['پولز', 'استطلاعات', 'पोल', 'Encuestas', 'Sondages'],
    'Notes': ['نوٹس', 'ملاحظات', 'नोट्स', 'Notas', 'Notes'],
    'Code': ['کوڈ', 'كود', 'कोड', 'Código', 'Code'],
    'Split expenses': ['اخراجات تقسیم کریں', 'تقسيم المصاريف', 'खर्च बाँटें', 'Dividir gastos', 'Partager les dépenses']
  };
  const ORDER = ['ur', 'ar', 'hi', 'es', 'fr'];
  const T = {}; ORDER.forEach(l => T[l] = {});
  Object.keys(D).forEach(k => ORDER.forEach((l, i) => { T[l][k] = D[k][i]; }));

  const cur = () => cfg.get('lang') || 'en';
  N.t = s => { const l = cur(); return (l === 'en' ? s : (T[l] && T[l][s])) || s; };
  const origText = new WeakMap(), origAttr = new WeakMap(), ATTR = ['placeholder', 'title', 'aria-label'];
  let busy = false;

  function trNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(p.nodeName) || (p.closest && p.closest('[data-notr]'))) return;
      let o = origText.get(n); const now = n.nodeValue;
      if (o && now !== o.out) o = null;                       // text changed by the app → new original
      const base = o ? o.src : now, key = base.trim();
      if (!key) return;
      const out = cur() === 'en' ? base : (T[cur()][key] ? base.replace(key, T[cur()][key]) : base);
      origText.set(n, { src: base, out }); if (n.nodeValue !== out) n.nodeValue = out;
    } else if (n.nodeType === 1) {
      if (n.hasAttribute('data-notr')) return;
      ATTR.forEach(a => {
        if (!n.hasAttribute(a)) return; const now = n.getAttribute(a); let m = origAttr.get(n) || {}, o = m[a];
        if (o && now !== o.out) o = null; const src = o ? o.src : now, key = src.trim();
        const out = cur() === 'en' ? src : (T[cur()][key] || src); m[a] = { src, out }; origAttr.set(n, m); if (now !== out) n.setAttribute(a, out);
      });
    }
  }
  function walk(root) {
    if (!root) return; busy = true;
    try {
      if (root.nodeType === 3) trNode(root);
      else { trNode(root); const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) trNode(n); }
    } finally { busy = false; }
  }
  N.i18nApply = root => walk(root || document.body);

  function applyDir() {
    const l = cur(), [, dir] = LANGS[l] || LANGS.en;
    document.documentElement.lang = l; document.documentElement.dir = dir; document.documentElement.classList.toggle('rtl', dir === 'rtl');
  }
  let queued = 0;
  const mo = new MutationObserver(ms => {
    if (busy || cur() === 'en') return;
    ms.forEach(m => { if (m.type === 'childList') m.addedNodes.forEach(n => { if (!(n.nodeType === 1 && n.id === 'toasts')) walk(n); }); else if (m.type === 'characterData') trNode(m.target); else if (m.type === 'attributes') trNode(m.target); });
  });
  function boot() { mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR }); applyDir(); walk(document.body); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  N.setLang = l => { if (!LANGS[l]) return; cfg.set('lang', l); applyDir(); walk(document.body); };
  cfg.on(k => { if (k === 'lang' || k === '*') { applyDir(); walk(document.body); document.querySelectorAll('[data-lang-btn] [data-lang-name]').forEach(x => x.textContent = LANGS[cur()][0]); } });

  /* language picker: click once to open, click again to close */
  N.langButton = (cls = '') => `<button type="button" data-lang-btn data-notr class="icon-btn soft !w-auto px-3 gap-1.5 text-sm font-semibold ${cls}" title="Language">${N.icons ? '' : ''}<span aria-hidden="true">🌐</span><span data-lang-name class="max-[480px]:hidden">${LANGS[cur()][0]}</span></button>`;
  N.langMenu = anchor => {
    const old = document.getElementById('langMenu'); if (old) { old.remove(); if (old._for === anchor) return; }
    const m = document.createElement('div'); m.id = 'langMenu'; m._for = anchor; m.setAttribute('data-notr', '');
    m.className = 'menu-pop fixed z-[200] min-w-[11rem] p-1.5 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-2xl pop-in';
    m.innerHTML = Object.keys(LANGS).map(k => `<button type="button" data-l="${k}" class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-start hover:bg-[var(--panel2)] ${k === cur() ? 'font-bold text-gold' : ''}"><span>${LANGS[k][0]}</span>${k === cur() ? '✓' : ''}</button>`).join('');
    document.body.append(m);
    const r = anchor.getBoundingClientRect(), w = m.offsetWidth, rtl = document.documentElement.dir === 'rtl';
    m.style.top = Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(innerWidth - w - 8, rtl ? r.left : r.right - w)) + 'px';
    m.onclick = e => { const b = e.target.closest('[data-l]'); if (b) { N.setLang(b.dataset.l); m.remove(); } };
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lang-btn]'); if (b) { e.stopPropagation(); return N.langMenu(b); }
    const m = document.getElementById('langMenu'); if (m && !m.contains(e.target)) m.remove();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.getElementById('langMenu'); if (m) m.remove(); } });
  N.LANGS = LANGS;
})();
