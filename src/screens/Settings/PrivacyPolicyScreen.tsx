/**
 * PrivacyPolicyScreen — loads `public/legal/privacy.html` in-app.
 */

import React from "react";
import { LegalDocumentView } from "./LegalDocumentView";

export const PrivacyPolicyScreen: React.FC = () => (
  <LegalDocumentView slug="privacy" titleKey="about.privacyPolicy" />
);

export default PrivacyPolicyScreen;
