import Constants from "expo-constants";
import appConfig from "../../app.json";

export const SERVICE_NAME = "텅장관리";
export const WEBSITE_URL = "https://solpa.shinhanacademy.co.kr";
export const OPERATOR_NAME = "ucmnuniverse";
export const SUPPORT_EMAIL = "ucmnuniverse@gmail.com";
export const APP_VERSION =
  Constants.expoConfig?.version ?? appConfig.expo.version;
