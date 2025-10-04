/**
 * Liste complète des pays avec codes téléphoniques
 * Source: https://en.wikipedia.org/wiki/List_of_country_calling_codes
 */

export interface Country {
  id: string;
  name: string;
  code: string;
  flag: string;
  region: string;
}

export const countries: Country[] = [
  // Europe
  { id: 'fr', name: 'France', code: '+33', flag: '🇫🇷', region: 'Europe' },
  { id: 'de', name: 'Allemagne', code: '+49', flag: '🇩🇪', region: 'Europe' },
  { id: 'gb', name: 'Royaume-Uni', code: '+44', flag: '🇬🇧', region: 'Europe' },
  { id: 'it', name: 'Italie', code: '+39', flag: '🇮🇹', region: 'Europe' },
  { id: 'es', name: 'Espagne', code: '+34', flag: '🇪🇸', region: 'Europe' },
  { id: 'be', name: 'Belgique', code: '+32', flag: '🇧🇪', region: 'Europe' },
  { id: 'ch', name: 'Suisse', code: '+41', flag: '🇨🇭', region: 'Europe' },
  { id: 'nl', name: 'Pays-Bas', code: '+31', flag: '🇳🇱', region: 'Europe' },
  { id: 'at', name: 'Autriche', code: '+43', flag: '🇦🇹', region: 'Europe' },
  { id: 'se', name: 'Suède', code: '+46', flag: '🇸🇪', region: 'Europe' },
  { id: 'no', name: 'Norvège', code: '+47', flag: '🇳🇴', region: 'Europe' },
  { id: 'dk', name: 'Danemark', code: '+45', flag: '🇩🇰', region: 'Europe' },
  { id: 'fi', name: 'Finlande', code: '+358', flag: '🇫🇮', region: 'Europe' },
  { id: 'pl', name: 'Pologne', code: '+48', flag: '🇵🇱', region: 'Europe' },
  { id: 'cz', name: 'République tchèque', code: '+420', flag: '🇨🇿', region: 'Europe' },
  { id: 'hu', name: 'Hongrie', code: '+36', flag: '🇭🇺', region: 'Europe' },
  { id: 'ro', name: 'Roumanie', code: '+40', flag: '🇷🇴', region: 'Europe' },
  { id: 'bg', name: 'Bulgarie', code: '+359', flag: '🇧🇬', region: 'Europe' },
  { id: 'gr', name: 'Grèce', code: '+30', flag: '🇬🇷', region: 'Europe' },
  { id: 'pt', name: 'Portugal', code: '+351', flag: '🇵🇹', region: 'Europe' },
  { id: 'ie', name: 'Irlande', code: '+353', flag: '🇮🇪', region: 'Europe' },
  { id: 'lu', name: 'Luxembourg', code: '+352', flag: '🇱🇺', region: 'Europe' },
  { id: 'mt', name: 'Malte', code: '+356', flag: '🇲🇹', region: 'Europe' },
  { id: 'cy', name: 'Chypre', code: '+357', flag: '🇨🇾', region: 'Europe' },
  { id: 'ee', name: 'Estonie', code: '+372', flag: '🇪🇪', region: 'Europe' },
  { id: 'lv', name: 'Lettonie', code: '+371', flag: '🇱🇻', region: 'Europe' },
  { id: 'lt', name: 'Lituanie', code: '+370', flag: '🇱🇹', region: 'Europe' },
  { id: 'sk', name: 'Slovaquie', code: '+421', flag: '🇸🇰', region: 'Europe' },
  { id: 'si', name: 'Slovénie', code: '+386', flag: '🇸🇮', region: 'Europe' },
  { id: 'hr', name: 'Croatie', code: '+385', flag: '🇭🇷', region: 'Europe' },
  { id: 'rs', name: 'Serbie', code: '+381', flag: '🇷🇸', region: 'Europe' },
  { id: 'ba', name: 'Bosnie-Herzégovine', code: '+387', flag: '🇧🇦', region: 'Europe' },
  { id: 'me', name: 'Monténégro', code: '+382', flag: '🇲🇪', region: 'Europe' },
  { id: 'mk', name: 'Macédoine du Nord', code: '+389', flag: '🇲🇰', region: 'Europe' },
  { id: 'al', name: 'Albanie', code: '+355', flag: '🇦🇱', region: 'Europe' },
  { id: 'ru', name: 'Russie', code: '+7', flag: '🇷🇺', region: 'Europe' },
  { id: 'ua', name: 'Ukraine', code: '+380', flag: '🇺🇦', region: 'Europe' },
  { id: 'by', name: 'Biélorussie', code: '+375', flag: '🇧🇾', region: 'Europe' },
  { id: 'md', name: 'Moldavie', code: '+373', flag: '🇲🇩', region: 'Europe' },

  // Amérique du Nord
  { id: 'us', name: 'États-Unis', code: '+1', flag: '🇺🇸', region: 'Amérique du Nord' },
  { id: 'ca', name: 'Canada', code: '+1', flag: '🇨🇦', region: 'Amérique du Nord' },
  { id: 'mx', name: 'Mexique', code: '+52', flag: '🇲🇽', region: 'Amérique du Nord' },

  // Amérique du Sud
  { id: 'br', name: 'Brésil', code: '+55', flag: '🇧🇷', region: 'Amérique du Sud' },
  { id: 'ar', name: 'Argentine', code: '+54', flag: '🇦🇷', region: 'Amérique du Sud' },
  { id: 'cl', name: 'Chili', code: '+56', flag: '🇨🇱', region: 'Amérique du Sud' },
  { id: 'co', name: 'Colombie', code: '+57', flag: '🇨🇴', region: 'Amérique du Sud' },
  { id: 'pe', name: 'Pérou', code: '+51', flag: '🇵🇪', region: 'Amérique du Sud' },
  { id: 've', name: 'Venezuela', code: '+58', flag: '🇻🇪', region: 'Amérique du Sud' },
  { id: 'ec', name: 'Équateur', code: '+593', flag: '🇪🇨', region: 'Amérique du Sud' },
  { id: 'bo', name: 'Bolivie', code: '+591', flag: '🇧🇴', region: 'Amérique du Sud' },
  { id: 'py', name: 'Paraguay', code: '+595', flag: '🇵🇾', region: 'Amérique du Sud' },
  { id: 'uy', name: 'Uruguay', code: '+598', flag: '🇺🇾', region: 'Amérique du Sud' },
  { id: 'gy', name: 'Guyana', code: '+592', flag: '🇬🇾', region: 'Amérique du Sud' },
  { id: 'sr', name: 'Suriname', code: '+597', flag: '🇸🇷', region: 'Amérique du Sud' },

  // Asie
  { id: 'cn', name: 'Chine', code: '+86', flag: '🇨🇳', region: 'Asie' },
  { id: 'jp', name: 'Japon', code: '+81', flag: '🇯🇵', region: 'Asie' },
  { id: 'kr', name: 'Corée du Sud', code: '+82', flag: '🇰🇷', region: 'Asie' },
  { id: 'in', name: 'Inde', code: '+91', flag: '🇮🇳', region: 'Asie' },
  { id: 'th', name: 'Thaïlande', code: '+66', flag: '🇹🇭', region: 'Asie' },
  { id: 'vn', name: 'Vietnam', code: '+84', flag: '🇻🇳', region: 'Asie' },
  { id: 'sg', name: 'Singapour', code: '+65', flag: '🇸🇬', region: 'Asie' },
  { id: 'my', name: 'Malaisie', code: '+60', flag: '🇲🇾', region: 'Asie' },
  { id: 'id', name: 'Indonésie', code: '+62', flag: '🇮🇩', region: 'Asie' },
  { id: 'ph', name: 'Philippines', code: '+63', flag: '🇵🇭', region: 'Asie' },
  { id: 'tw', name: 'Taïwan', code: '+886', flag: '🇹🇼', region: 'Asie' },
  { id: 'hk', name: 'Hong Kong', code: '+852', flag: '🇭🇰', region: 'Asie' },
  { id: 'mo', name: 'Macao', code: '+853', flag: '🇲🇴', region: 'Asie' },
  { id: 'mn', name: 'Mongolie', code: '+976', flag: '🇲🇳', region: 'Asie' },
  { id: 'kz', name: 'Kazakhstan', code: '+7', flag: '🇰🇿', region: 'Asie' },
  { id: 'uz', name: 'Ouzbékistan', code: '+998', flag: '🇺🇿', region: 'Asie' },
  { id: 'kg', name: 'Kirghizistan', code: '+996', flag: '🇰🇬', region: 'Asie' },
  { id: 'tj', name: 'Tadjikistan', code: '+992', flag: '🇹🇯', region: 'Asie' },
  { id: 'tm', name: 'Turkménistan', code: '+993', flag: '🇹🇲', region: 'Asie' },
  { id: 'af', name: 'Afghanistan', code: '+93', flag: '🇦🇫', region: 'Asie' },
  { id: 'pk', name: 'Pakistan', code: '+92', flag: '🇵🇰', region: 'Asie' },
  { id: 'bd', name: 'Bangladesh', code: '+880', flag: '🇧🇩', region: 'Asie' },
  { id: 'lk', name: 'Sri Lanka', code: '+94', flag: '🇱🇰', region: 'Asie' },
  { id: 'np', name: 'Népal', code: '+977', flag: '🇳🇵', region: 'Asie' },
  { id: 'bt', name: 'Bhoutan', code: '+975', flag: '🇧🇹', region: 'Asie' },
  { id: 'mv', name: 'Maldives', code: '+960', flag: '🇲🇻', region: 'Asie' },
  { id: 'mm', name: 'Myanmar', code: '+95', flag: '🇲🇲', region: 'Asie' },
  { id: 'la', name: 'Laos', code: '+856', flag: '🇱🇦', region: 'Asie' },
  { id: 'kh', name: 'Cambodge', code: '+855', flag: '🇰🇭', region: 'Asie' },
  { id: 'bn', name: 'Brunei', code: '+673', flag: '🇧🇳', region: 'Asie' },

  // Moyen-Orient
  { id: 'sa', name: 'Arabie saoudite', code: '+966', flag: '🇸🇦', region: 'Moyen-Orient' },
  { id: 'ae', name: 'Émirats arabes unis', code: '+971', flag: '🇦🇪', region: 'Moyen-Orient' },
  { id: 'qa', name: 'Qatar', code: '+974', flag: '🇶🇦', region: 'Moyen-Orient' },
  { id: 'kw', name: 'Koweït', code: '+965', flag: '🇰🇼', region: 'Moyen-Orient' },
  { id: 'bh', name: 'Bahreïn', code: '+973', flag: '🇧🇭', region: 'Moyen-Orient' },
  { id: 'om', name: 'Oman', code: '+968', flag: '🇴🇲', region: 'Moyen-Orient' },
  { id: 'ye', name: 'Yémen', code: '+967', flag: '🇾🇪', region: 'Moyen-Orient' },
  { id: 'iq', name: 'Irak', code: '+964', flag: '🇮🇶', region: 'Moyen-Orient' },
  { id: 'sy', name: 'Syrie', code: '+963', flag: '🇸🇾', region: 'Moyen-Orient' },
  { id: 'lb', name: 'Liban', code: '+961', flag: '🇱🇧', region: 'Moyen-Orient' },
  { id: 'jo', name: 'Jordanie', code: '+962', flag: '🇯🇴', region: 'Moyen-Orient' },
  { id: 'il', name: 'Israël', code: '+972', flag: '🇮🇱', region: 'Moyen-Orient' },
  { id: 'ps', name: 'Palestine', code: '+970', flag: '🇵🇸', region: 'Moyen-Orient' },
  { id: 'tr', name: 'Turquie', code: '+90', flag: '🇹🇷', region: 'Moyen-Orient' },
  { id: 'ir', name: 'Iran', code: '+98', flag: '🇮🇷', region: 'Moyen-Orient' },

  // Afrique
  { id: 'za', name: 'Afrique du Sud', code: '+27', flag: '🇿🇦', region: 'Afriq' },
  { id: 'ng', name: 'Nigeria', code: '+234', flag: '🇳🇬', region: 'Afrique' },
  { id: 'eg', name: 'Égypte', code: '+20', flag: '🇪🇬', region: 'Afrique' },
  { id: 'ma', name: 'Maroc', code: '+212', flag: '🇲🇦', region: 'Afrique' },
  { id: 'dz', name: 'Algérie', code: '+213', flag: '🇩🇿', region: 'Afrique' },
  { id: 'tn', name: 'Tunisie', code: '+216', flag: '🇹🇳', region: 'Afrique' },
  { id: 'ly', name: 'Libye', code: '+218', flag: '🇱🇾', region: 'Afrique' },
  { id: 'sd', name: 'Soudan', code: '+249', flag: '🇸🇩', region: 'Afrique' },
  { id: 'et', name: 'Éthiopie', code: '+251', flag: '🇪🇹', region: 'Afrique' },
  { id: 'ke', name: 'Kenya', code: '+254', flag: '🇰🇪', region: 'Afrique' },
  { id: 'ug', name: 'Ouganda', code: '+256', flag: '🇺🇬', region: 'Afrique' },
  { id: 'tz', name: 'Tanzanie', code: '+255', flag: '🇹🇿', region: 'Afrique' },
  { id: 'rw', name: 'Rwanda', code: '+250', flag: '🇷🇼', region: 'Afrique' },
  { id: 'bi', name: 'Burundi', code: '+257', flag: '🇧🇮', region: 'Afrique' },
  { id: 'mw', name: 'Malawi', code: '+265', flag: '🇲🇼', region: 'Afrique' },
  { id: 'zm', name: 'Zambie', code: '+260', flag: '🇿🇲', region: 'Afrique' },
  { id: 'zw', name: 'Zimbabwe', code: '+263', flag: '🇿🇼', region: 'Afrique' },
  { id: 'bw', name: 'Botswana', code: '+267', flag: '🇧🇼', region: 'Afrique' },
  { id: 'na', name: 'Namibie', code: '+264', flag: '🇳🇦', region: 'Afrique' },
  { id: 'sz', name: 'Eswatini', code: '+268', flag: '🇸🇿', region: 'Afrique' },
  { id: 'ls', name: 'Lesotho', code: '+266', flag: '🇱🇸', region: 'Afrique' },
  { id: 'mg', name: 'Madagascar', code: '+261', flag: '🇲🇬', region: 'Afrique' },
  { id: 'mu', name: 'Maurice', code: '+230', flag: '🇲🇺', region: 'Afrique' },
  { id: 'sc', name: 'Seychelles', code: '+248', flag: '🇸🇨', region: 'Afrique' },
  { id: 'km', name: 'Comores', code: '+269', flag: '🇰🇲', region: 'Afrique' },
  { id: 'dj', name: 'Djibouti', code: '+253', flag: '🇩🇯', region: 'Afrique' },
  { id: 'so', name: 'Somalie', code: '+252', flag: '🇸🇴', region: 'Afrique' },
  { id: 'er', name: 'Érythrée', code: '+291', flag: '🇪🇷', region: 'Afrique' },
  { id: 'ss', name: 'Soudan du Sud', code: '+211', flag: '🇸🇸', region: 'Afrique' },
  { id: 'cf', name: 'République centrafricaine', code: '+236', flag: '🇨🇫', region: 'Afrique' },
  { id: 'ne', name: 'Niger', code: '+227', flag: '🇳🇪', region: 'Afrique' },
  { id: 'ml', name: 'Mali', code: '+223', flag: '🇲🇱', region: 'Afrique' },
  { id: 'bf', name: 'Burkina Faso', code: '+226', flag: '🇧🇫', region: 'Afrique' },
  { id: 'ci', name: 'Côte d\'Ivoire', code: '+225', flag: '🇨🇮', region: 'Afrique' },
  { id: 'gh', name: 'Ghana', code: '+233', flag: '🇬🇭', region: 'Afrique' },
  { id: 'tg', name: 'Togo', code: '+228', flag: '🇹🇬', region: 'Afrique' },
  { id: 'bj', name: 'Bénin', code: '+229', flag: '🇧🇯', region: 'Afrique' },
  { id: 'sn', name: 'Sénégal', code: '+221', flag: '🇸🇳', region: 'Afrique' },
  { id: 'gm', name: 'Gambie', code: '+220', flag: '🇬🇲', region: 'Afrique' },
  { id: 'gw', name: 'Guinée-Bissau', code: '+245', flag: '🇬🇼', region: 'Afrique' },
  { id: 'gn', name: 'Guinée', code: '+224', flag: '🇬🇳', region: 'Afrique' },
  { id: 'sl', name: 'Sierra Leone', code: '+232', flag: '🇸🇱', region: 'Afrique' },
  { id: 'lr', name: 'Libéria', code: '+231', flag: '🇱🇷', region: 'Afrique' },
  { id: 'cv', name: 'Cap-Vert', code: '+238', flag: '🇨🇻', region: 'Afrique' },
  { id: 'st', name: 'São Tomé-et-Príncipe', code: '+239', flag: '🇸🇹', region: 'Afrique' },
  { id: 'gq', name: 'Guinée équatoriale', code: '+240', flag: '🇬🇶', region: 'Afrique' },
  { id: 'ga', name: 'Gabon', code: '+241', flag: '🇬🇦', region: 'Afrique' },
  { id: 'cg', name: 'Congo', code: '+242', flag: '🇨🇬', region: 'Afrique' },
  { id: 'cd', name: 'République démocratique du Congo', code: '+243', flag: '🇨🇩', region: 'Afrique' },
  { id: 'ao', name: 'Angola', code: '+244', flag: '🇦🇴', region: 'Afrique' },
  { id: 'cm', name: 'Cameroun', code: '+237', flag: '🇨🇲', region: 'Afrique' },

  // Océanie
  { id: 'au', name: 'Australie', code: '+61', flag: '🇦🇺', region: 'Océanie' },
  { id: 'nz', name: 'Nouvelle-Zélande', code: '+64', flag: '🇳🇿', region: 'Océanie' },
  { id: 'fj', name: 'Fidji', code: '+679', flag: '🇫🇯', region: 'Océanie' },
  { id: 'pg', name: 'Papouasie-Nouvelle-Guinée', code: '+675', flag: '🇵🇬', region: 'Océanie' },
  { id: 'sb', name: 'Îles Salomon', code: '+677', flag: '🇸🇧', region: 'Océanie' },
  { id: 'vu', name: 'Vanuatu', code: '+678', flag: '🇻🇺', region: 'Océanie' },
  { id: 'nc', name: 'Nouvelle-Calédonie', code: '+687', flag: '🇳🇨', region: 'Océanie' },
  { id: 'pf', name: 'Polynésie française', code: '+689', flag: '🇵🇫', region: 'Océanie' },
  { id: 'ws', name: 'Samoa', code: '+685', flag: '🇼🇸', region: 'Océanie' },
  { id: 'to', name: 'Tonga', code: '+676', flag: '🇹🇴', region: 'Océanie' },
  { id: 'ki', name: 'Kiribati', code: '+686', flag: '🇰🇮', region: 'Océanie' },
  { id: 'tv', name: 'Tuvalu', code: '+688', flag: '🇹🇻', region: 'Océanie' },
  { id: 'nr', name: 'Nauru', code: '+674', flag: '🇳🇷', region: 'Océanie' },
  { id: 'pw', name: 'Palaos', code: '+680', flag: '🇵🇼', region: 'Océanie' },
  { id: 'fm', name: 'Micronésie', code: '+691', flag: '🇫🇲', region: 'Océanie' },
  { id: 'mh', name: 'Îles Marshall', code: '+692', flag: '🇲🇭', region: 'Océanie' },
  { id: 'ck', name: 'Îles Cook', code: '+682', flag: '🇨🇰', region: 'Océanie' },
  { id: 'nu', name: 'Niue', code: '+683', flag: '🇳🇺', region: 'Océanie' },
  { id: 'tk', name: 'Tokelau', code: '+690', flag: '🇹🇰', region: 'Océanie' },
  { id: 'wf', name: 'Wallis-et-Futuna', code: '+681', flag: '🇼🇫', region: 'Océanie' },
];

// Fonction pour rechercher un pays
export const searchCountries = (query: string): Country[] => {
  const lowercaseQuery = query.toLowerCase();
  return countries.filter(country => 
    country.name.toLowerCase().includes(lowercaseQuery) ||
    country.code.includes(query) ||
    country.flag.includes(query)
  );
};

// Fonction pour obtenir les pays par région
export const getCountriesByRegion = (region: string): Country[] => {
  return countries.filter(country => country.region === region);
};

// Fonction pour obtenir les régions
export const getRegions = (): string[] => {
  return [...new Set(countries.map(country => country.region))];
};

export default countries;
