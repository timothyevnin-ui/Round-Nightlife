import SpotsPage, { metadata as spotsMetadata } from "../spots/page";

/** The Map tab (V25). Same page as /spots, which still works for old links. */
export const revalidate = 60;
export const metadata = spotsMetadata;
export default SpotsPage;
