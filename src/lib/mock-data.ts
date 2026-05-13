export type Editoria =
  | "CIDADE"
  | "POLÍTICA"
  | "ESPORTE"
  | "CULTURA"
  | "POLÍCIA"
  | "PRAIAS";

export type Article = {
  id: string;
  editoria: Editoria;
  title: string;
  lede?: string;
  image?: string;
  imageAlt?: string;
  author?: string;
  publishedAt: string;
  slug: string;
  isBreaking?: boolean;
  videoUrl?: string;
};

export type MuralPost = {
  id: string;
  author: string;
  bairro: string;
  postedAt: string;
  body: string;
  isAnon?: boolean;
  likes: number;
  comments: number;
};

export type BazarItem = {
  id: string;
  title: string;
  type: "Vende" | "Doa" | "Troca" | "Procura";
  price: string;
  bairro: string;
  postedAt: string;
  category?: string;
  description?: string;
  whatsapp?: string;
  photo_url?: string;
};

export const breakingNews =
  "BR-101 sentido Florianópolis está bloqueada por caminhão tombado na altura do trevo de Imbituba — DEINFRA estima 2h pra liberar";

export const heroMain: Article = {
  id: "h1",
  editoria: "CIDADE",
  title:
    "Porto de Imbituba bate recorde histórico de exportações no primeiro trimestre",
  lede:
    "Movimentação chega a 2,1 milhões de toneladas e supera Itajaí em volume de granéis. Setor projeta novo terminal de fertilizantes para 2027.",
  image: "/imagens/porto-aereo.jpg",
  imageAlt: "Vista aérea do Porto de Imbituba com navios atracados",
  author: "Camila Espíndola",
  publishedAt: "há 38 min",
  slug: "porto-imbituba-recorde-exportacoes",
};

export const heroSecondary: Article[] = [
  {
    id: "h2",
    editoria: "POLÍTICA",
    title:
      "Câmara aprova reforma da orla por 9 votos a 2 — obras começam em janeiro",
    publishedAt: "há 2h",
    slug: "camara-aprova-reforma-orla",
  },
  {
    id: "h3",
    editoria: "CULTURA",
    title:
      "Festa de Nossa Senhora da Imaculada Conceição leva 12 mil pessoas ao Centro",
    image: "/imagens/centro-aereo.webp",
    imageAlt: "Vista aérea do Centro de Imbituba e da igreja matriz",
    publishedAt: "há 4h",
    slug: "festa-imaculada-conceicao-2026",
  },
  {
    id: "h4",
    editoria: "ESPORTE",
    title:
      "Imbitubense Cauã Costa vence o Mundial de Surf Júnior em Saquarema",
    publishedAt: "ontem",
    slug: "caua-costa-mundial-surf-junior",
  },
];

export const articlesCidade: Article[] = [
  {
    id: "c1",
    editoria: "CIDADE",
    title:
      "Reforma da Av. Dr. João Rimsa entra na fase final após 14 meses de obras",
    image: "/imagens/centro-aereo.webp",
    imageAlt: "Centro de Imbituba visto do alto",
    lede:
      "Pavimentação rígida e ciclovia de 2,4 km devem ser entregues em fevereiro.",
    publishedAt: "há 1h",
    slug: "av-joao-rimsa-fase-final",
  },
  {
    id: "c2",
    editoria: "CIDADE",
    title:
      "Posto de saúde do Mirim recebe ampliação de R$ 2,4 milhões com novo bloco pediátrico",
    publishedAt: "há 3h",
    slug: "posto-mirim-ampliacao",
  },
  {
    id: "c3",
    editoria: "CIDADE",
    title: "Coleta seletiva chega a mais 4 bairros em janeiro",
    publishedAt: "há 5h",
    slug: "coleta-seletiva-quatro-bairros",
  },
  {
    id: "c4",
    editoria: "CIDADE",
    title:
      "Câmara discute fim do estacionamento rotativo na Rua Henrique Lage",
    publishedAt: "há 6h",
    slug: "fim-rotativo-henrique-lage",
  },
];

export const articlesPraias: Article[] = [
  {
    id: "p1",
    editoria: "PRAIAS",
    title:
      "Praia da Vila ganha plano de despoluição com aporte de R$ 8 mi do governo do estado",
    image: "/imagens/praia-veraneio.jpg",
    imageAlt: "Praia da Vila com guarda-sóis coloridos vista de cima",
    lede:
      "Projeto inclui novo emissário submarino e estação de tratamento na altura da rua Manoel Borges.",
    publishedAt: "há 2h",
    slug: "praia-vila-despoluicao",
  },
  {
    id: "p2",
    editoria: "PRAIAS",
    title:
      "Guarda do Embaú recebe certificação 'Bandeira Azul' pela 5ª temporada consecutiva",
    image: "/imagens/costa-rochosa.webp",
    imageAlt: "Costa rochosa do litoral sul de Santa Catarina",
    publishedAt: "há 4h",
    slug: "guarda-embau-bandeira-azul-2026",
  },
  {
    id: "p3",
    editoria: "PRAIAS",
    title: "Marola fora de época prejudica pesca artesanal no Mirim",
    publishedAt: "há 7h",
    slug: "marola-pesca-mirim",
  },
  {
    id: "p4",
    editoria: "PRAIAS",
    title:
      "Bombeiros alertam para água-viva na orla durante o feriado prolongado",
    publishedAt: "há 8h",
    slug: "bombeiros-agua-viva-feriado",
  },
];

export const muralPosts: MuralPost[] = [
  {
    id: "m1",
    author: "Marina Cavalcanti",
    bairro: "Centro",
    postedAt: "há 12 min",
    body:
      "Alguém viu uma cachorrinha branca, raça Lhasa, perdida na rua Pedro Bittencourt? Atende por 'Pituca' e tá com coleira azul.",
    likes: 47,
    comments: 12,
  },
  {
    id: "m2",
    author: "Anônimo",
    bairro: "Mirim",
    postedAt: "há 28 min",
    body:
      "Por que demoram tanto pra arrumar o sinal de trânsito da Henrique Lage com a Av. Dr. João Rimsa? Já são 3 semanas piscando o amarelo.",
    isAnon: true,
    likes: 89,
    comments: 34,
  },
  {
    id: "m3",
    author: "Roberto Silva",
    bairro: "Vila Nova",
    postedAt: "há 1h",
    body:
      "Ressaca de ontem quebrou o deck novo da Pampilhosa. Alguém tem foto? Tô tentando levar pro vereador.",
    likes: 23,
    comments: 8,
  },
  {
    id: "m4",
    author: "Cláudia Mendes",
    bairro: "Praia da Vila",
    postedAt: "há 2h",
    body: "Comércio aqui da praia tá sem energia desde de manhã. CELESC não responde.",
    likes: 56,
    comments: 19,
  },
  {
    id: "m5",
    author: "Anônimo",
    bairro: "Centro",
    postedAt: "há 2h",
    body:
      "Lixo acumulando há 4 dias na rua dos Comerciários. COMCAP disse que ia passar terça e nada. Já é sexta.",
    isAnon: true,
    likes: 134,
    comments: 41,
  },
  {
    id: "m6",
    author: "Diego Wagner",
    bairro: "Ibiraquera",
    postedAt: "há 3h",
    body:
      "Galera, alguém indica um pedreiro bom pra reformar muro? Tô precisando de uns 8 metros e o último que chamei sumiu com o sinal.",
    likes: 12,
    comments: 27,
  },
  {
    id: "m7",
    author: "Vanessa Rocha",
    bairro: "Mirim",
    postedAt: "há 4h",
    body:
      "Pra quem ainda não sabe: a feira da pracinha agora rola sábado às 7h da manhã. Tem peixe fresco do rapaz da Barra.",
    likes: 78,
    comments: 9,
  },
  {
    id: "m8",
    author: "Anônimo",
    bairro: "Vila Nova",
    postedAt: "há 5h",
    body:
      "Bombeiros chegaram em 4 minutos quando o vizinho passou mal. Parabéns pelo serviço — Imbituba ganhou de novo nesse aspecto.",
    isAnon: true,
    likes: 203,
    comments: 31,
  },
  {
    id: "m9",
    author: "Gabriela Maia",
    bairro: "Praia do Rosa",
    postedAt: "há 6h",
    body:
      "Onda boa pra quem é iniciante hoje cedo. Mar calmo, ventinho leve. Levei a Maria de stand-up e foi um sucesso 🌊",
    likes: 45,
    comments: 6,
  },
  {
    id: "m10",
    author: "Anônimo",
    bairro: "Centro",
    postedAt: "ontem",
    body:
      "Por que ninguém fala sobre o esgoto que tá descendo na rua direto pra galeria? Faz mais de 6 meses. Vou levar pro MP.",
    isAnon: true,
    likes: 167,
    comments: 52,
  },
  {
    id: "m11",
    author: "Felipe Schwarz",
    bairro: "Ibiraquera",
    postedAt: "ontem",
    body:
      "Procuro turma pra jogar futsal terça e quinta à noite na quadra da escola. Tenho 4 confirmados, falta 2.",
    likes: 18,
    comments: 14,
  },
  {
    id: "m12",
    author: "Anônimo",
    bairro: "Praia da Vila",
    postedAt: "ontem",
    body:
      "Achei uma carteira azul perto do Mercado Paulista hoje cedo. Tá com R$120 e os documentos. Quem perdeu chama no inbox.",
    isAnon: true,
    likes: 92,
    comments: 18,
  },
];

export const bazarItems: BazarItem[] = [
  {
    id: "b1",
    title: "Sofá 3 lugares retrátil em couro sintético — semi-novo",
    type: "Vende",
    price: "R$ 350",
    bairro: "Centro",
    postedAt: "há 2h",
  },
  {
    id: "b2",
    title: "Barco a remo 5m com motor Yamaha 9.9HP",
    type: "Vende",
    price: "R$ 1.200",
    bairro: "Vila Nova",
    postedAt: "há 4h",
  },
  {
    id: "b3",
    title: "Bicicleta infantil aro 16, usei pouco",
    type: "Doa",
    price: "Grátis",
    bairro: "Mirim",
    postedAt: "há 6h",
  },
  {
    id: "b4",
    title: "Geladeira Brastemp Frost-Free 380L",
    type: "Troca",
    price: "p/ bicicleta adulto",
    bairro: "Centro",
    postedAt: "ontem",
  },
  {
    id: "b5",
    title: "6 cadeiras de praia coloridas, dobráveis",
    type: "Doa",
    price: "Grátis",
    bairro: "Praia da Vila",
    postedAt: "ontem",
  },
  {
    id: "b6",
    title: "Geladinhos artesanais p/ festa de réveillon — 50un",
    type: "Vende",
    price: "R$ 1,50",
    bairro: "Centro",
    postedAt: "há 8h",
    category: "Alimentação",
  },
  {
    id: "b7",
    title: "Prancha de surf 6'2\" Mormaii — usada uma temporada",
    type: "Vende",
    price: "R$ 1.450",
    bairro: "Praia da Vila",
    postedAt: "há 10h",
    category: "Esporte",
  },
  {
    id: "b8",
    title: "Procuro: kitnet pra alugar até R$1.200 — Centro ou Mirim",
    type: "Procura",
    price: "Até R$ 1.200",
    bairro: "Centro",
    postedAt: "há 12h",
    category: "Imóveis",
  },
  {
    id: "b9",
    title: "Mesa de jantar 6 lugares + cadeiras (madeira maciça)",
    type: "Vende",
    price: "R$ 890",
    bairro: "Mirim",
    postedAt: "ontem",
    category: "Móveis",
  },
  {
    id: "b10",
    title: "Filhotes de SRD pra adoção responsável — vacinados",
    type: "Doa",
    price: "Grátis",
    bairro: "Vila Nova",
    postedAt: "ontem",
    category: "Pets",
  },
  {
    id: "b11",
    title: "Procuro ajudante de pedreiro p/ obra de 3 semanas",
    type: "Procura",
    price: "R$ 180/dia",
    bairro: "Ibiraquera",
    postedAt: "ontem",
    category: "Serviços",
  },
  {
    id: "b12",
    title: "iPhone 12 64GB azul — bateria 88% c/ caixa e nota",
    type: "Vende",
    price: "R$ 2.150",
    bairro: "Centro",
    postedAt: "há 2 dias",
    category: "Eletrônicos",
  },
  {
    id: "b13",
    title: "Roupas infantis 4–6 anos — saco com 30 peças",
    type: "Doa",
    price: "Grátis",
    bairro: "Praia do Rosa",
    postedAt: "há 2 dias",
    category: "Vestuário",
  },
  {
    id: "b14",
    title: "Fogão Atlas 5 bocas — funcionando, p/ trocar por geladeira",
    type: "Troca",
    price: "p/ geladeira simples",
    bairro: "Vila Nova",
    postedAt: "há 3 dias",
    category: "Eletrodomésticos",
  },
  {
    id: "b15",
    title: "Ração Premier 15kg adultos — embalagem fechada",
    type: "Vende",
    price: "R$ 220",
    bairro: "Centro",
    postedAt: "há 3 dias",
    category: "Pets",
  },
  {
    id: "b16",
    title: "Bicicleta MTB aro 29 21v — revisada semana passada",
    type: "Vende",
    price: "R$ 720",
    bairro: "Mirim",
    postedAt: "há 4 dias",
    category: "Esporte",
  },
  {
    id: "b17",
    title: "Sofá-cama 2 lugares preto — pequeno desgaste no braço",
    type: "Doa",
    price: "Grátis",
    bairro: "Centro",
    postedAt: "há 4 dias",
    category: "Móveis",
  },
];

export const enquete = {
  pergunta: "A reforma da orla vai realmente melhorar Imbituba?",
  opcoes: [
    { label: "Sim, vai valorizar a região", percent: 67 },
    { label: "Não, é só mais uma promessa", percent: 23 },
    { label: "Talvez, depende da execução", percent: 10 },
  ],
  total: 1843,
};

export const maisLidas: Article[] = [
  {
    id: "ml1",
    editoria: "POLÍCIA",
    title: "Operação prende 4 em rede de furto de cabos no Aeroporto de Jaguaruna",
    publishedAt: "ontem",
    slug: "...",
  },
  {
    id: "ml2",
    editoria: "CIDADE",
    title: "Apagão deixa parte do Centro sem luz por 6 horas",
    publishedAt: "há 8h",
    slug: "...",
  },
  {
    id: "ml3",
    editoria: "ESPORTE",
    title: "Olho-d'Água vence o Vasco da Praia em jogo polêmico do regional",
    publishedAt: "há 12h",
    slug: "...",
  },
  {
    id: "ml4",
    editoria: "PRAIAS",
    title: "Foca aparece em Garopaba e atrai dezenas de curiosos na Ferrugem",
    publishedAt: "há 1d",
    slug: "...",
  },
  {
    id: "ml5",
    editoria: "CULTURA",
    title: "Banda Carnavália anuncia trio elétrico no Centro pra Carnaval 2026",
    publishedAt: "há 2d",
    slug: "...",
  },
];

export const tempo = {
  cidade: "Imbituba",
  tempC: 24,
  condicao: "Ensolarado",
  ondaM: 1.6,
  proximos: [
    { dia: "Hoje", min: 19, max: 26, icone: "☀" },
    { dia: "Sex", min: 20, max: 28, icone: "☀" },
    { dia: "Sáb", min: 22, max: 30, icone: "🌤" },
    { dia: "Dom", min: 23, max: 29, icone: "⛅" },
  ],
};

export const trending = ["#reformadaorla", "#porto2026", "#caualendario", "#bandazul"];
