import { formatAppVersionLabel } from "@/utils/app-version-format";
import appConfig from "../../app.json";

export function getAppVersionLabel(): string {
  return formatAppVersionLabel(appConfig.expo.version);
}
