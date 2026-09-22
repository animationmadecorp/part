// Etat initial éditorial conservé comme repli local. Les mêmes identifiants
// stables sont utilisés par les documents Sanity et par les seed scripts.
export const siteSettings = {
  stableId: "site-settings:animation-made",
  status: "published",
  brand: "Animation Made",
};

const initialPageSections = {
  home: [
    {
      stableId: "section:nouveau-bio",
      style: "bio",
      heading: "Moi, c’est",
      emphasis: "Made.",
      items: [
        { stableId: "bio:career", body: "J’ai commencé en tant qu’animatrice 3D, puis je suis très vite devenue lead animatrice sur du long métrage et de la série. Je suis ensuite devenue prof de gestion de production, d’animation et d’anglais." },
        { stableId: "bio:studios", body: "Aujourd’hui, je suis à mon compte et j’ai réussi à faire de l’animation une de mes activités principales. Après avoir travaillé dans cinq studios, je connais aussi bien le travail en studio que l’entrepreneuriat et le travail pour soi." },
        { stableId: "bio:mission", body: "À force d’observer tout ça, j’ai décidé de tout rassembler ici, dans des cours et des reviews." },
      ],
    },
    {
      stableId: "section:nouveau-gifts",
      style: "gift",
      eyebrow: "POUR COMMENCER GRATUITEMENT",
      heading: "Des ressources gratuites",
      emphasis: "pour tes projets.",
      body: "Des add-ons Blender pour tes animations, des conseils pour postuler et des infos sur l’intermittence : crée ton espace gratuit pour accéder aux ressources.",
      items: [{ stableId: "gift:more", body: "Découvre aussi les add-ons Blender associés aux formations et aux reviews." }],
      ctaLabel: "Créer mon espace gratuit",
      ctaHref: "/nouveau/bibliotheque",
      sheetLabel: "LES RESSOURCES GRATUITES",
      sheetTitle: "Add-ons Blender et conseils pratiques.",
      sheetBody: "Par exemple : un add-on pour installer un éclairage, ajuster le fond et mettre ton animation en valeur au rendu.",
    },
    {
      stableId: "section:nouveau-problems",
      style: "problems",
      heading: "Ces offres te seront",
      emphasis: "utiles si…",
      items: [
        { stableId: "problem:starting", title: "Tu es encore à l’école ou tu viens d’en sortir, et tu ne sais pas par où commencer pour construire la suite." },
        { stableId: "problem:animation", title: "Tu retravailles tes plans d’animation, mais tu ne sais plus ce qui manque pour les améliorer." },
        { stableId: "problem:portfolio", title: "Tu prépares ton book ou ton showreel, mais tu ne sais pas comment l’organiser, quels projets ou plans sélectionner, ni dans quel ordre les présenter." },
        { stableId: "problem:english", title: "Les tutos en anglais pourraient te faire progresser, mais la langue te freine." },
        { stableId: "problem:visibility", title: "Tu aimerais partager ton travail sur les réseaux, sans savoir quoi publier ni comment commencer." },
        { stableId: "problem:priority", title: "Tu passes du temps à apprendre, mais tu as du mal à choisir quoi travailler en priorité pour ton propre projet." },
      ],
    },
  ],
  feedback: [
    {
      stableId: "section:feedback-submission",
      style: "feature",
      heading: "Quels plans",
      emphasis: "peux-tu envoyer ?",
      items: [
        { stableId: "feedback:limit-plans", title: "Jusqu’à 3 plans par commande." },
        { stableId: "feedback:limit-duration", title: "15 secondes au total maximum.", body: "Un seul plan de 15 secondes ou plusieurs plans courts : la limite porte sur leur durée cumulée." },
        { stableId: "feedback:focus", title: "Les passages sur lesquels tu veux progresser.", body: "Indique ce qui te pose problème et ce que tu souhaites travailler." },
      ],
    },
    {
      stableId: "section:feedback-corrections",
      style: "cards",
      heading: "Des corrections",
      emphasis: "au bon endroit.",
      items: [
        { stableId: "feedback:drawings", title: "Des annotations dessinées", body: "Pour montrer une pose, une trajectoire ou un ajustement directement sur l’image concernée." },
        { stableId: "feedback:comments", title: "Des commentaires liés à la vidéo", body: "Pour comprendre le retour dans son contexte et retrouver facilement le passage à retravailler." },
        { stableId: "feedback:priorities", title: "Des priorités pour tes corrections", body: "Pour distinguer ce qui change vraiment la lecture du plan des détails à reprendre ensuite." },
      ],
    },
    {
      stableId: "section:feedback-steps",
      style: "steps",
      heading: "Comment ça se passe ?",
      items: [
        { stableId: "feedback:step-upload", title: "Tu déposes tes plans", body: "Dans ton espace personnel, tu ajoutes tes vidéos et précises ce que tu cherches à améliorer ou les passages qui te posent problème." },
        { stableId: "feedback:step-annotate", title: "J’annote ton animation", body: "Je dessine sur les images et j’ajoute des commentaires aux moments concernés pour expliquer ce qui fonctionne, ce qui bloque et comment le retravailler." },
        { stableId: "feedback:step-review", title: "Tu retrouves tes corrections", body: "Tu consultes les vidéos annotées dans ton espace, tu reviens sur les passages commentés et tu reprends ton travail à ton rythme." },
      ],
    },
    {
      stableId: "section:feedback-work",
      style: "prose",
      heading: "Ce qu’on travaille",
      emphasis: "sur tes plans.",
      body: "Les poses, le timing, le mouvement et la lisibilité : je t’aide à comprendre ce qui fonctionne et ce que tu peux améliorer dans ton animation.",
      items: [{ stableId: "feedback:work-portfolio", body: "Pour sélectionner tes projets et organiser ton portfolio, découvre aussi la review de book/showreel." }],
    },
    {
      stableId: "section:feedback-project",
      style: "steps",
      eyebrow: "PROJET D’ANIMATION · SANS VISIO",
      heading: "Ton idée de plan,",
      emphasis: "une méthode pour l’animer.",
      body: "Tu me présentes ton projet et tes références. Je prends le temps de les étudier pour te préparer un document illustré : une proposition de poses clés, des étapes de travail et les erreurs à éviter. Tu démarres ton animation, puis je te fais deux retours annotés au fil de tes corrections.",
      items: [
        { stableId: "feedback:project-present", title: "Tu présentes ton projet.", body: "Dans le questionnaire, tu décris ce que tu veux montrer, ton niveau et tes références. Tu peux partir d’une idée, sans avoir déjà commencé l’animation." },
        { stableId: "feedback:project-roadmap", title: "Je prépare ta feuille de route.", body: "Tu reçois un document personnalisé avec des images, des dessins ou des captures de Blender pour comprendre par où commencer, quelles poses travailler et à quoi faire attention." },
        { stableId: "feedback:project-first-review", title: "Tu animes, je fais une première review.", body: "Tu m’envoies ta première version. Je dessine sur les images et commente les passages à retravailler pour guider tes corrections." },
        { stableId: "feedback:project-second-review", title: "Tu corriges, je fais une deuxième review.", body: "Tu reprends ton plan à ton rythme, puis tu m’envoies ta nouvelle version. Je te fais un dernier retour annoté pour affiner ton animation." },
      ],
    },
    {
      stableId: "section:feedback-project-details",
      style: "cards",
      heading: "Le format du projet",
      items: [
        { stableId: "feedback:project-short", title: "Un seul plan court", body: "Jusqu’à 15 secondes maximum, avec un projet adapté au format. Tu choisis ton personnage et ton rig, et tu prépares ta scène en autonomie." },
        { stableId: "feedback:project-document", title: "Un document à garder sous les yeux", body: "La préparation est remise sous 7 jours maximum après réception des éléments de ton projet. Si un imprévu décale ce délai, tu es prévenu·e." },
        { stableId: "feedback:project-space", title: "Deux retours dans ton espace", body: "Chaque review est remise sous 7 jours maximum après réception de ta version à corriger. Tu retrouves tes annotations et commentaires dans ton espace et tu avances entre chaque envoi. Aucun rendez-vous à réserver." },
      ],
    },
  ],
  review: [
    {
      stableId: "section:review-intro",
      style: "prose",
      body: "Pas de visio à prévoir. Tu peux lire mes retours à ton rythme et conserver le document.",
    },
    {
      stableId: "section:review-submission",
      style: "feature",
      heading: "Qu’est-ce que tu peux",
      emphasis: "m’envoyer ?",
      items: [
        { stableId: "review:submitted-book", title: "Ton book ou showreel déjà monté", body: "Pour revoir la sélection, l’ordre et la présentation." },
        { stableId: "review:submitted-selection", title: "Une sélection de travaux", body: "Pour choisir les projets ou les plans à intégrer et organiser l’ensemble." },
      ],
      body: "Choisis ce qui correspond à ta situation : pas besoin d’avoir un montage finalisé.",
    },
    {
      stableId: "section:review-contents",
      style: "cards",
      heading: "Ce que tu trouveras",
      emphasis: "dans ton PDF.",
      items: [
        { stableId: "review:keep", title: "Ce qu’il faut conserver", body: "Tes points forts et les travaux qui servent ton objectif." },
        { stableId: "review:remove", title: "Ce qu’il vaut mieux retirer ou retravailler", body: "Avec les raisons, pour comprendre chaque choix." },
        { stableId: "review:order", title: "Un ordre de présentation conseillé", body: "Pour organiser tes projets ou tes plans." },
        { stableId: "review:missing", title: "Les éléments manquants", body: "En distinguant l’essentiel de ce qui peut attendre." },
        { stableId: "review:priorities", title: "Les modifications prioritaires", body: "Pour savoir par où commencer." },
        { stableId: "review:next", title: "Des conseils pour la suite", body: "En fonction de tes envies et des opportunités que tu vises." },
      ],
    },
    {
      stableId: "section:review-steps",
      style: "steps",
      eyebrow: "DU PREMIER ENVOI À TA NOUVELLE VERSION",
      heading: "Comment ça se passe ?",
      items: [
        { stableId: "review:step-send", title: "Tu présentes ton projet", body: "Tu remplis le questionnaire et partages les liens vers tes travaux, puis tu règles la review." },
        { stableId: "review:step-guide", title: "Je prépare ton guide", body: "Tu reçois ton PDF personnalisé sous sept jours après réception du paiement et de tous les éléments nécessaires." },
        { stableId: "review:step-work", title: "Tu retravailles ton book", body: "Tu appliques les conseils à ton rythme, en gardant le PDF comme référence." },
        { stableId: "review:step-return", title: "On regarde ta nouvelle version", body: "Pour le lancement, je t’offre un deuxième retour sur le même book après tes corrections." },
      ],
    },
    {
      stableId: "section:review-types",
      style: "prose",
      heading: "Quels types de travaux ?",
      body: "Mon domaine principal est l’animation 3D. Je propose aussi des reviews de showreels d’animation 2D, ainsi qu’un regard global sur les portfolios de modélisation et les books généralistes.",
      items: [{ stableId: "review:animation-scope", body: "Je te donne aussi un avis global sur tes animations : leurs points forts et ce qui reste à améliorer. Ici, on travaille surtout sur le book dans son ensemble, pas sur une correction détaillée de chaque plan." }],
    },
  ],
  visibility: [
    {
      stableId: "section:visibility-submission",
      style: "feature",
      heading: "Ton travail mérite",
      emphasis: "d’être montré. Mais comment ?",
      items: [
        { stableId: "visibility:ideas-start", title: "Tu as des idées, mais tu ne sais pas par où commencer.", body: "Des reels en tête, des brouillons ou des essais : tu aimerais leur donner une direction et savoir quoi développer." },
        { stableId: "visibility:no-direction", title: "Tu publies sans direction claire.", body: "Tu aimerais que tes publications racontent mieux ce que tu fais et ce que tu veux développer." },
        { stableId: "visibility:stay-yourself", title: "Tu veux rester toi-même.", body: "Parler face caméra ou exposer ta vie personnelle n’est pas une obligation pour partager ton travail." },
      ],
    },
    {
      stableId: "section:visibility-contents",
      style: "cards",
      heading: "Ta fiche,",
      emphasis: "un fil rouge pour créer.",
      items: [
        { stableId: "visibility:thread", title: "Ton fil rouge et tes valeurs", body: "Ce qui relie ton travail, tes envies et ce que tu défends, pour donner une direction cohérente à tes contenus." },
        { stableId: "visibility:point-of-view", title: "Ton point de vue singulier", body: "Une formulation claire de l’idée que tu remets en question dans ton milieu, si tu en as une, sans chercher la contradiction à tout prix." },
        { stableId: "visibility:strengths", title: "Tes forces à mettre en avant", body: "Les aspects de ton travail et de ta personnalité qui pourraient intéresser les autres, et des pistes pour les montrer." },
        { stableId: "visibility:audience", title: "Un public auquel t’adresser", body: "Un persona : le portrait du public auquel tes contenus pourraient plaire, ses attentes et ce qu’il pourrait trouver chez toi." },
        { stableId: "visibility:ideas", title: "Des idées de contenus", body: "Des thèmes, des formats et des pistes concrètes à partir de tes idées de reels, de publications et de tes références." },
        { stableId: "visibility:income", title: "Des pistes pour vivre de ton art", body: "Des activités, services ou produits à explorer selon tes forces et tes envies. Des possibilités à tester, sans promesse de revenus." },
      ],
    },
    {
      stableId: "section:visibility-steps",
      style: "steps",
      heading: "Comment ça se passe ?",
      items: [
        { stableId: "visibility:step-present", title: "Tu présentes ton univers", body: "Tu remplis un questionnaire approfondi et ajoutes tes liens ou pièces jointes : travaux, idées de reels, essais, brouillons et références. Pas besoin d’avoir déjà publié." },
        { stableId: "visibility:step-study", title: "J’étudie tes réponses et tes contenus", body: "Je prends le temps de comprendre tes forces, tes envies et ton point de vue. Si un élément manque, je te pose mes questions par écrit." },
        { stableId: "visibility:step-delivery", title: "Tu reçois ta fiche personnalisée", body: "Tu retrouves un fil rouge, des idées et des pistes adaptées à ton profil dans une fiche à conserver. Tu peux t’y référer pour préparer tes contenus et choisir ce que tu veux explorer ensuite." },
      ],
    },
    {
      stableId: "section:visibility-questionnaire",
      style: "feature",
      heading: "Le questionnaire,",
      emphasis: "pour comprendre ton univers.",
      body: "Tu me parles de tes forces, de tes envies et de tes idées de contenus, avec des liens ou des pièces jointes pour me montrer ton univers. Par exemple :",
      items: [
        { stableId: "visibility:question-known", title: "Pour quoi aimerais-tu être connu·e ?" },
        { stableId: "visibility:question-singular", title: "Qu’est-ce qui, selon toi, rend ton travail ou ton regard singulier ?" },
      ],
    },
    {
      stableId: "section:visibility-direction",
      style: "feature",
      heading: "Une direction adaptée",
      emphasis: "à tes projets d’artiste.",
      body: "Un plan d’animation, des recherches de poses, un breakdown ou les étapes d’un projet peuvent devenir des sujets de contenu. L’idée n’est pas de tout publier, mais de choisir ce qui montre ton travail et sert tes objectifs.",
      items: [
        { stableId: "visibility:no-community", title: "Pas besoin d’une communauté déjà installée.", body: "On peut partir de tes projets, même si tu n’as encore rien publié." },
        { stableId: "visibility:control", title: "Tu gardes la main sur tes contenus.", body: "Cette offre t’aide à définir quoi partager et comment le présenter. La création et la publication restent de ton côté." },
      ],
    },
  ],
  english: [
    {
      stableId: "section:english-intro",
      style: "feature",
      heading: "Comprendre, écouter,",
      emphasis: "prendre la parole.",
      body: "On reprend les bases, on s’entraîne à parler, on travaille ton accent et les bons temps au bon moment. Le but : moins hésiter sur « comment je vais dire ça ? » et être plus à l’aise pour échanger. On développe aussi ton écoute et le vocabulaire de l’animation pour mieux comprendre les tutos et les explications techniques.",
    },
    {
      stableId: "section:english-topics",
      style: "list",
      heading: "De l’anglais,",
      emphasis: "avec de l’animation dedans.",
      items: [
        { stableId: "english:tutorials", title: "Comprendre les tutos qui t’intéressent.", body: "Pour apprendre de nouvelles techniques sans que la langue soit un obstacle à chaque phrase." },
        { stableId: "english:comment", title: "Commenter un extrait de dessin animé.", body: "Décrire une action, parler d’un personnage, donner ton avis : des supports pour faire vivre la conversation." },
        { stableId: "english:projects", title: "Parler de tes projets.", body: "Pratiquer le vocabulaire de l’animation pour expliquer ce que tu fais et échanger sur ton travail." },
      ],
    },
    {
      stableId: "section:english-formats",
      style: "cards",
      heading: "Seul ou à deux,",
      emphasis: "un cours qui vous correspond.",
      items: [
        { stableId: "english:solo", title: "En cours particulier", body: "On se concentre sur tes difficultés et tes objectifs. Le contenu et le rythme du cours s’adaptent à ce que tu as besoin de comprendre et de pratiquer." },
        { stableId: "english:duo", title: "Avec un ami", body: "Vous venez à deux pour apprendre et pratiquer ensemble, à un tarif plus avantageux par personne. Des niveaux et des objectifs proches permettent à chacun de profiter du cours." },
      ],
    },
    {
      stableId: "section:english-practice",
      style: "prose",
      heading: "Entre les cours,",
      emphasis: "continue à pratiquer.",
      items: [
        { stableId: "english:practice-lessons", body: "Dès ton premier cours acheté, tu accèdes aux leçons complémentaires et à un GPT d’entraînement basé sur mes leçons, inclus dans l’offre, pour pratiquer sur ChatGPT entre les séances." },
        { stableId: "english:practice-access", body: "Ces ressources sont incluses à l’unité comme en pack, en individuel comme en duo." },
      ],
    },
    {
      stableId: "section:english-reschedule",
      style: "prose",
      heading: "Un changement",
      emphasis: "de programme ?",
      body: "Tu peux reporter ton cours jusqu’à 24 heures avant le rendez-vous. À moins de 24 heures ou en cas d’absence, la séance est décomptée, sauf exception que je t’accorde.",
    },
  ],
};

export const pages = [
  {
    stableId: "page:nouveau-home",
    slug: "/nouveau",
    status: "published",
    title: "Animation Made — faire de ton talent une vraie trajectoire",
    description:
      "Des cours et des retours personnalisés pour progresser en animation, construire ton showreel, apprendre en anglais et faire connaître ton travail.",
    hero: {
      eyebrow: "Pour les étudiants et jeunes artistes en cinéma d’animation",
      title: "Faire de ton talent",
      emphasisPrefix: "une vraie",
      emphasis: "trajectoire.",
      lead: "Des cours et des retours personnalisés pour progresser en animation, construire ton showreel, apprendre en anglais ou faire connaître ton travail sur les réseaux.",
    },
    seo: {
      title: "Animation Made — faire de ton talent une vraie trajectoire",
      description:
        "Des cours et des retours personnalisés pour progresser en animation, construire ton showreel, apprendre en anglais et faire connaître ton travail.",
    },
    sections: initialPageSections.home,
  },
  {
    stableId: "page:nouveau-feedback",
    slug: "/nouveau/feedback",
    status: "published",
    title: "Feedback d’animation — Animation Made",
    description:
      "Un retour directement sur tes plans d’animation, avec des dessins sur les images et des commentaires précis pour guider tes corrections.",
    hero: {
      eyebrow: "FEEDBACK D’ANIMATION",
      title: "Comprendre ce qui bloque.",
      emphasis: "Savoir quoi retravailler.",
      lead: "Un retour directement sur tes plans d’animation, avec des dessins sur les images et des commentaires précis pour guider tes corrections.",
    },
    seo: {
      title: "Feedback d’animation — Animation Made",
      description:
        "Un retour directement sur tes plans d’animation, avec des dessins sur les images et des commentaires précis pour guider tes corrections.",
    },
    sections: initialPageSections.feedback,
  },
  {
    stableId: "page:nouveau-review",
    slug: "/nouveau/review",
    status: "published",
    title: "Review de book et showreel — Animation Made",
    description:
      "Un regard extérieur pour choisir tes projets, raconter ton parcours et donner envie de travailler avec toi.",
    hero: {
      eyebrow: "REVIEW DE BOOK / SHOWREEL",
      title: "Quoi garder,\nquoi changer,",
      emphasis: "et dans quel ordre ?",
      lead: "Un regard extérieur sur ton book, adapté à ce que tu veux faire ensuite. Tu réponds d’abord à un court questionnaire pour m’expliquer où tu en es et où tu veux aller. Puis tu m’envoies tes travaux : je te prépare un guide PDF personnalisé pour retravailler ta présentation.",
    },
    seo: {
      title: "Review de book et showreel — Animation Made",
      description:
        "Un regard extérieur pour choisir tes projets, raconter ton parcours et donner envie de travailler avec toi.",
    },
    sections: initialPageSections.review,
  },
  {
    stableId: "page:nouveau-visibilite",
    slug: "/nouveau/visibilite",
    status: "published",
    title: "Te faire connaître sur les réseaux — Animation Made",
    description:
      "Un questionnaire approfondi et une fiche personnalisée : fil rouge, valeurs, public, idées de contenus et pistes pour vivre de ton art. Sans visio.",
    hero: {
      eyebrow: "CRÉATION DE CONTENU · CINÉMA D’ANIMATION",
      title: "Te faire connaître",
      emphasis: "sur les réseaux.",
      lead: "Tu as des idées de contenus, mais tu hésites à te lancer ou tu cherches une direction ? Tu me présentes ton travail, tes envies et tes premières idées. Je te prépare une fiche personnalisée pour identifier tes forces, le public auquel t’adresser et les pistes à explorer. Tout se fait par écrit, sans visio.",
    },
    seo: {
      title: "Te faire connaître sur les réseaux — Animation Made",
      description:
        "Un questionnaire approfondi et une fiche personnalisée : fil rouge, valeurs, public, idées de contenus et pistes pour vivre de ton art. Sans visio.",
    },
    sections: initialPageSections.visibility,
  },
  {
    stableId: "page:nouveau-anglais",
    slug: "/nouveau/anglais",
    status: "published",
    title: "Cours d’anglais pour les artistes — Animation Made",
    description:
      "Comprendre et parler anglais avec des cours sur mesure autour de l’animation. En individuel ou à deux avec un ami, en visio.",
    hero: {
      eyebrow: "ANGLAIS · COURS SUR MESURE",
      title: "Comprendre l’anglais.",
      emphasis: "Et le parler.",
      lead: "« Would have overlooked », « should have been drawn »… Tu reconnais des mots, mais tu ne comprends pas pourquoi on les assemble comme ça ? Des cours sur mesure pour comprendre et parler anglais, avec l’animation comme terrain de pratique.",
    },
    seo: {
      title: "Cours d’anglais pour les artistes — Animation Made",
      description:
        "Comprendre et parler anglais avec des cours sur mesure autour de l’animation. En individuel ou à deux avec un ami, en visio.",
    },
    sections: initialPageSections.english,
  },
];

export const offers = [
{ stableId: "offer:feedback", slug: "feedback", number: "01", title: "Faire progresser ton animation", category: "Feedback d’animation", description: "Un regard précis sur tes plans pour comprendre ce qui fonctionne et savoir quoi retravailler.", icon: "film", color: "peach", status: "published", sortOrder: 10, entitlementKey: "feedback" },
{ stableId: "offer:review", slug: "review", number: "02", title: "Un book qui te ressemble", category: "Review de book / showreel", description: "Choisir tes meilleurs projets, raconter ton parcours et donner envie de travailler avec toi.", icon: "frames", color: "pink", status: "published", sortOrder: 20, entitlementKey: "review" },
{ stableId: "offer:visibilite", slug: "visibilite", number: "03", title: "Te faire connaître sur les réseaux", category: "Création de contenu", description: "Créer du contenu, trouver ton angle et parler de ton travail sans jouer un personnage.", icon: "sparkles", color: "yellow", status: "published", sortOrder: 30, entitlementKey: "contenu" },
{ stableId: "offer:anglais", slug: "anglais", number: "04", title: "Apprendre plus vite, voir plus loin", category: "Anglais pour l’animation", description: "Comprendre les tutos en anglais pour apprendre plus vite, parler de ton travail et préparer tes échanges à l’international.", icon: "globe", color: "blue", status: "published", sortOrder: 40, entitlementKey: "anglais" }
];
export const review = {
stableId: "offer:review-details",
title: "Ton book mérite un deuxième regard.",
summary: "Tu as les projets. Ensemble, on trouve comment les faire parler pour toi.",
audience: "Étudiants et jeunes artistes de l’animation qui préparent une candidature, un stage ou leur première opportunité.",
duration: "Sous 7 jours", sessions: "1 guide PDF personnalisé", price: "28 €",
included: ["Un guide PDF personnalisé à conserver", "Un retour sur la sélection, l’ordre et la présentation", "Des priorités concrètes pour ta prochaine version", "Un deuxième retour ciblé offert pendant le lancement"],
};
export const resources = [
{ id: "selection", stableId: "resource:selection", status: "published", sortOrder: 10, title: "Choisir les projets qui te représentent", collection: "Portfolio", format: "Leçon", access: "review", accessRule: "offer", accessKey: "review", color: "pink", symbol: "01", subtitle: "Moins de projets. Plus d’intention.", description: "Une méthode courte pour sélectionner les projets qui racontent le mieux ton regard et la direction que tu veux prendre.", progress: 35, metadata: [{ label: "Temps de lecture", value: "8 min" }, { label: "Niveau", value: "Tous niveaux" }] },
{ id: "checklist", stableId: "resource:checklist", status: "published", sortOrder: 20, title: "La checklist de ton prochain book", collection: "Portfolio", format: "Fiche", access: "review", accessRule: "offer", accessKey: "review", color: "peach", symbol: "✓", subtitle: "Le dernier regard avant l’envoi.", description: "Une vérification simple pour relire ton book avec du recul avant de l’envoyer.", metadata: [{ label: "Longueur", value: "2 pages" }, { label: "Format", value: "PDF A4" }], availability: { download: false } },
{ id: "presentation", stableId: "resource:presentation", status: "published", sortOrder: 30, title: "Présenter ton travail avec clarté", collection: "Portfolio", format: "E-book", access: "review", accessRule: "offer", accessKey: "review", color: "blue", symbol: "Aa", subtitle: "Des projets qui racontent quelque chose.", description: "Des repères concrets pour écrire des présentations courtes, précises et faciles à parcourir.", metadata: [{ label: "Longueur", value: "18 pages" }, { label: "Format", value: "PDF" }], availability: { download: false } },
{ id: "scene-light", stableId: "resource:scene-light", status: "published", sortOrder: 40, title: "Personnalise ta scène Blender", collection: "Animation", format: "Add-on", access: "free", accessRule: "free", color: "yellow", symbol: "↗", subtitle: "Une lumière et un fond, sans tout refaire.", description: "Un add-on simple pour installer une lumière, ajuster le fond et donner rapidement une présentation plus soignée à ton animation.", metadata: [{ label: "Compatibilité", value: "À confirmer" }, { label: "Contenu", value: "Lumière et fond" }, { label: "Installation", value: "Depuis Blender" }], availability: { download: false } },
{ id: "routine", stableId: "resource:routine", status: "published", sortOrder: 50, title: "Avant de partager ton animation", collection: "Animation", format: "Fiche", access: "free", accessRule: "free", color: "peach", symbol: "✳", subtitle: "Cinq questions pour prendre du recul.", description: "Une fiche express pour vérifier la lecture, le rythme et l’intention de ton plan avant de demander un retour.", metadata: [{ label: "Longueur", value: "1 page" }, { label: "Format", value: "PDF A4" }], availability: { download: false } },
{ id: "english", stableId: "resource:english", status: "published", sortOrder: 60, title: "Parler de ton plan en anglais", collection: "Anglais", format: "Vidéo", access: "english", accessRule: "offer", accessKey: "anglais", color: "blue", symbol: "Hello.", subtitle: "Les mots pour parler de ton métier.", description: "Le vocabulaire essentiel pour expliquer ton intention, décrire un mouvement et demander un retour précis.", metadata: [{ label: "Durée", value: "12 min" }, { label: "Niveau", value: "Débutant" }], availability: { play: false } },
{ id: "visibility", stableId: "resource:visibility", status: "published", sortOrder: 70, title: "Trouver ton angle de créateur", collection: "Contenu", format: "Leçon", access: "visibility", accessRule: "offer", accessKey: "contenu", color: "pink", symbol: "Hey!", subtitle: "Une présence qui te ressemble.", description: "Un exercice guidé pour trouver un fil rouge entre ce que tu crées, ce que tu apprends et ce que tu veux partager.", metadata: [{ label: "Temps de lecture", value: "10 min" }, { label: "Niveau", value: "Tous niveaux" }] }
];

// Ces réponses reprennent uniquement des informations déjà publiées sur les
// fiches d’offres. Elles constituent l’état initial du modèle FAQ ; aucun prix
// contractuel ni donnée privée n’y est stocké.
export const faqs = [
  {
    stableId: "faq:nouveau-offres",
    slug: "nouveau-offres",
    status: "published",
    title: "Questions fréquentes",
    sortOrder: 10,
    items: [
      { stableId: "faq-item:feedback-limits", question: "Quels plans peux-tu envoyer pour un feedback ?", answer: "Jusqu’à 3 plans par commande, pour 15 secondes au total maximum. Tu indiques les passages sur lesquels tu veux progresser et ce qui te pose problème." },
      { stableId: "faq-item:review-delivery", question: "Que reçois-tu avec la review de book ?", answer: "Un guide PDF personnalisé à conserver, avec la sélection, l’ordre, la présentation et les priorités à retravailler. Il est remis sous sept jours après réception du paiement et de tous les éléments nécessaires." },
      { stableId: "faq-item:visibility-format", question: "Comment se passe l’accompagnement de visibilité ?", answer: "Tu remplis un questionnaire approfondi avec des liens ou des pièces jointes, puis tu reçois une fiche personnalisée. Tout se fait par écrit, sans visio." },
      { stableId: "faq-item:english-format", question: "Les cours d’anglais se font-ils seul ou à deux ?", answer: "Tu peux suivre un cours particulier sur mesure ou venir avec un ami. Les cours ont lieu en visioconférence et s’appuient sur l’animation comme terrain de pratique." },
    ],
  },
];

export const editorialFallback = {
  siteSettings,
  pages,
  offers,
  resources,
  faqs,
};
