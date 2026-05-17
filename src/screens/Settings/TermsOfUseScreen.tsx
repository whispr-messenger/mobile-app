/**
 * TermsOfUseScreen — loads `public/legal/terms.html` in-app.
 */

import React from "react";
import { LegalDocumentView } from "./LegalDocumentView";

export const TermsOfUseScreen: React.FC = () => (
  <LegalDocumentView slug="terms" titleKey="about.termsOfUse" />
);

export default TermsOfUseScreen;
