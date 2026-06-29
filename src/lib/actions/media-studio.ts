// Barrel do Estúdio de mídia. As Server Actions agora vivem em módulos por tema
// (Server Actions só exportam funções async; helpers/tipos compartilhados ficam
// em ./media-studio/shared). Este barrel mantém o import público
// `@/lib/actions/media-studio` funcionando pros chamadores — sem mudar nada.

export {
  generateVariations,
  generateHeroVariations,
  generatePack,
} from "./media-studio/variations";

export {
  applySocialKitTemplate,
  applySocialKitTemplateToPost,
} from "./media-studio/social-kit";

export {
  applyAsArticleHero,
  refreshArticleHeroFromSource,
  setArticleHeroFromUrl,
  uploadArticleHeroFromForm,
} from "./media-studio/hero";

export {
  applyVariation,
  fetchSourceImage,
  applyHeroToAllSocialPosts,
  uploadMediaFromForm,
  clearPostMedia,
} from "./media-studio/social-media";

export type { HeroVariationsResult } from "./media-studio/shared";
