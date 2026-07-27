import { Directory, File, Paths } from "expo-file-system";
import { startActivityAsync } from "expo-intent-launcher";
import {
  addAssetsToAlbumAsync,
  createAlbumAsync,
  createAssetAsync,
  getAlbumAsync,
  requestPermissionsAsync as requestMediaLibraryPermissionsAsync,
  saveToLibraryAsync,
} from "expo-media-library";
import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import {
  isAvailableAsync as isSharingAvailableAsync,
  shareAsync,
} from "expo-sharing";
import { Platform } from "react-native";

import { authHeaders, mediaUrl } from "@/lib/discussion-upload";

/* ----(첨부 저장·열기 — RFC 0005 §4, RFC 0004 기능5 후속)---- */

// 첨부 바이트는 **항상** 세션 쿠키를 실은 서버 프록시(GET /media/discussion-*)에서만
// 받는다(RFC 0004 §158·§191·§203). 서명 URL·토큰 쿼리는 쓰지 않고, 외부 앱에는
// 로컬 content:// 만 넘긴다.
//
// 저장 위치 — 사진은 갤러리 앨범(이름만 넘기고 실제 경로는 OS가 정한다),
// 파일은 Android는 사용자가 SAF 디렉터리 피커로 고른 폴더 아래, iOS는 앱
// 문서함(Paths.document) 아래 `moneyroad/file/`.
// 실제 경로를 코드에 박지 않는다(§151). 광범위 저장소 권한도 추가하지 않는다(§204).
//
// **플랫폼 분기는 이 파일 안에만 있다.** 화면(screens/discussion-room/**)은
// Platform을 몰라야 하므로, 플랫폼마다 다른 사정(폴더 선택이 필요한지, 어디에
// 저장됐는지, 어떻게 여는지)은 전부 이 모듈의 반환값·에러 코드로만 드러낸다.

// 앨범 이름은 **평면 단일 토큰**이어야 한다.
// - iOS: 앨범에 계층이 없어 "moneyroad/image"를 주면 슬래시가 이름에 그대로 박힌다.
// - Android: 앨범 조회가 BUCKET_DISPLAY_NAME(마지막 세그먼트) 단일 비교라
//   중첩 이름으로는 getAlbumAsync가 항상 null → 저장할 때마다 앨범이 새로 생긴다.
const GALLERY_ALBUM = "moneyroad";
const SAVE_DIR_SEGMENTS = ["moneyroad", "file"] as const;

// 저장된 위치를 사용자에게 알려 줄 문구. 화면이 플랫폼별 문구를 조립하지 않도록
// 완성된 라벨을 lib이 돌려준다.
const GALLERY_ALBUM_LABEL = `갤러리 ${GALLERY_ALBUM} 앨범`;
const PHOTO_LIBRARY_LABEL = "사진 보관함";

// 사용자가 고른 SAF 트리와 그 아래 저장 폴더. 트리 URI는 피커가
// takePersistableUriPermission을 걸어줘서 앱 재시작 후에도 유효하다.
// SAF는 문서 ID가 불투명해 경로 조합으로 하위를 가리킬 수 없으므로, 한 번 만든
// 저장 폴더의 URI 자체를 남겨 두고 그대로 되살린다.
const SAVE_TREE_KEY = "mr.discussion-save-tree.v1";
const SAVE_DIR_KEY = "mr.discussion-save-dir.v1";

const VIEW_ACTION = "android.intent.action.VIEW";
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const GENERIC_MIME = "application/octet-stream";

const isNative = Platform.OS !== "web";
// **이 모듈의 유일한 플랫폼 게이트.** Android만 되는 두 가지를 가른다:
//  - 저장: SAF(Storage Access Framework) 디렉터리 피커. iOS는 피커 권한이 앱
//    세션 한정이라 재사용이 안 돼서 앱 문서함에 저장한다(RFC 0005 §4-4).
//  - 열기: expo-intent-launcher(Android 전용 모듈). iOS는 expo-sharing.
const isAndroid = Platform.OS === "android";

const PATH_SEP_RE = /[/\\]/;
const UNSAFE_NAME_RE = /[^\w.\-가-힣ㄱ-ㅎㅏ-ㅣ ()[\]]+/g;
const LEADING_DOTS_RE = /^\.+/;
const TRAILING_SLASH_RE = /\/+$/;
const URI_SEGMENT_RE = /[/:]/;
const MIME_PARAM_RE = /;.*$/;

const EXT_BY_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

// 서버가 mime을 모를 때(application/octet-stream) 확장자로 추정한다. 인텐트의
// type이 정확해야 처리할 앱이 잡힌다.
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/plain",
  csv: "text/csv",
  json: "application/json",
  xml: "text/xml",
  html: "text/html",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwp: "application/x-hwp",
  hwpx: "application/hwp+zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

// text/markdown을 처리하는 앱이 없어 인텐트가 그대로 실패한다(RFC 0005 §10 실측).
const VIEW_MIME_ALIASES: Record<string, string> = {
  "text/markdown": "text/plain",
  "text/x-markdown": "text/plain",
};

// 호출부가 실패 원인을 구분해 다른 안내를 띄울 수 있게 코드를 실어 던진다.
export const PICK_CANCELLED = "PICK_CANCELLED";
export const NO_VIEWER_APP = "NO_VIEWER_APP";

export class AttachmentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AttachmentError";
    this.code = code;
  }
}

// unknown으로 잡힌 에러에서 코드만 꺼낸다(호출부의 catch에서 쓰라고 export).
export function attachmentErrorCode(err: unknown): string | null {
  return err instanceof AttachmentError ? err.code : null;
}

// Basename + safe charset so a crafted filename can't escape the save folder.
function safeName(name: string): string {
  const base = name.split(PATH_SEP_RE).pop() ?? "file";
  const cleaned = base
    .replace(UNSAFE_NAME_RE, "_")
    .replace(LEADING_DOTS_RE, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "file";
}

// 저장 폴더에 실제로 쓰이는 파일명(§202 안전화 적용). 화면이 메시지의 원본
// 파일명을 저장 목록(savedFileNames)과 대조할 때 이 함수로 키를 맞춘다.
export function savedFileName(name: string): string {
  return safeName(name);
}

type SaveDir = { dir: Directory; label: string };

// 세션 캐시. 원본은 SecureStore이고 이건 그 위의 1차 캐시일 뿐이다.
let cachedSaveDir: SaveDir | null = null;

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // 퍼센트 인코딩이 깨져 있으면 원문 그대로 쓴다.
    return value;
  }
}

// 사용자에게 보여줄 저장 위치 문구. 실제 경로를 박는 대신 고른 폴더의 URI에서
// 뒤쪽 세그먼트만 뽑아 만든다(예: "Download/moneyroad/file").
function saveDirLabel(uri: string): string {
  const fallback = SAVE_DIR_SEGMENTS.join("/");
  if (!isAndroid) {
    // iOS는 앱 문서함에 저장하고 UIFileSharingEnabled로 '파일' 앱에 노출한다.
    // 파일 앱에 보이는 폴더 이름은 앱 표시 이름이라 코드에 박지 않는다.
    return `파일 앱의 ${fallback} 폴더`;
  }
  const decoded = decodeSafe(uri).replace(TRAILING_SLASH_RE, "");
  const tail = decoded
    .split(URI_SEGMENT_RE)
    .filter((segment) => segment.length > 0)
    .slice(-(SAVE_DIR_SEGMENTS.length + 1));
  return tail.length > 0 ? tail.join("/") : fallback;
}

function toSaveDir(dir: Directory): SaveDir {
  return { dir, label: saveDirLabel(dir.uri) };
}

async function readStored(key: string): Promise<string | null> {
  if (!isNative) {
    return null;
  }
  try {
    return await getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeStored(key: string, value: string): Promise<void> {
  if (!isNative) {
    return;
  }
  try {
    await setItemAsync(key, value);
  } catch {
    // 못 남겨도 이번 세션은 메모리 캐시로 동작한다.
  }
}

// 저장 폴더 선택을 초기화한다. 권한이 회수됐거나 사용자가 다른 폴더를 고르고
// 싶을 때 호출하면 다음 저장에서 피커가 다시 뜬다.
export async function forgetSaveDir(): Promise<void> {
  cachedSaveDir = null;
  if (!isNative) {
    return;
  }
  try {
    await deleteItemAsync(SAVE_TREE_KEY);
    await deleteItemAsync(SAVE_DIR_KEY);
  } catch {
    // 삭제 실패는 무시 — 어차피 접근 불가면 아래 exists 검사에서 걸러진다.
  }
}

function deleteQuietly(entry: Directory | File): void {
  try {
    if (entry.exists) {
      entry.delete();
    }
  } catch {
    // 정리 실패는 결과에 영향 없음.
  }
}

// 저장해 둔 URI를 되살린다. 권한이 회수되거나 폴더가 지워졌으면 exists가 조용히
// false를 돌려주므로 그걸로 유효성을 판정한다.
function usableDir(uri: string | null): Directory | null {
  if (!uri) {
    return null;
  }
  try {
    const dir = new Directory(uri);
    return dir.exists ? dir : null;
  } catch {
    return null;
  }
}

// SAF 트리에서는 경로 문자열을 이어붙여 자식을 가리킬 수 없다(문서 ID가 불투명해
// 조용히 트리 루트로 되돌아간다). 자식은 반드시 list()로 이름을 대조해 찾는다.
function childNamed(dir: Directory, name: string): Directory | File | null {
  for (const entry of dir.list()) {
    if (entry.name === name) {
      return entry;
    }
  }
  return null;
}

// createDirectory는 중복을 검사하지 않아 같은 이름이 있어도 "moneyroad (1)"을
// 새로 만든다. 있으면 재사용하고 없을 때만 만든다.
function ensureChildDir(parent: Directory, name: string): Directory {
  const found = childNamed(parent, name);
  return found instanceof Directory ? found : parent.createDirectory(name);
}

function saveLeafUnder(root: Directory): Directory {
  let dir = root;
  for (const segment of SAVE_DIR_SEGMENTS) {
    dir = ensureChildDir(dir, segment);
  }
  return dir;
}

async function pickSaveTree(): Promise<Directory> {
  let picked: Directory;
  try {
    picked = await Directory.pickDirectoryAsync();
  } catch {
    // 취소하면 PickerCancelledException으로 reject된다. 실패가 아니라 "안 골랐음"
    // 이므로 호출부가 에러 다이얼로그 대신 조용히 되돌릴 수 있게 코드를 실어 준다.
    throw new AttachmentError(
      PICK_CANCELLED,
      "저장할 폴더를 선택해야 파일을 받을 수 있어요."
    );
  }
  await writeStored(SAVE_TREE_KEY, picked.uri);
  return picked;
}

/* ----(iOS 저장 위치 — 앱 문서함)---- */
// iOS는 SAF가 없고 문서 피커로 받은 권한도 앱 세션 한정이라 재사용할 수 없다.
// 대신 앱 문서함 아래 고정 하위 폴더에 저장하고, UIFileSharingEnabled로 '파일'
// 앱에 노출한다(RFC 0005 §4-4). Paths.document는 OS가 주는 샌드박스 위치라
// 실제 경로를 코드에 박는 것이 아니다(§151).
function documentSaveDir(): Directory {
  return new Directory(Paths.document, ...SAVE_DIR_SEGMENTS);
}

// 사용자가 고를 것이 없으므로 피커도 뜨지 않는다.
function ensureDocumentSaveDir(): Directory {
  const dir = documentSaveDir();
  try {
    dir.create({ intermediates: true, idempotent: true });
  } catch {
    throw new Error("저장 폴더를 만들지 못했어요.");
  }
  return dir;
}
/* ----(~iOS 저장 위치 여기까지)---- */

// Android(SAF): 사용자가 고른 트리 아래에 저장 폴더를 만든다.
async function ensureSafSaveDir(): Promise<Directory> {
  const root =
    usableDir(await readStored(SAVE_TREE_KEY)) ?? (await pickSaveTree());
  try {
    return saveLeafUnder(root);
  } catch {
    // 고른 폴더에 쓸 수 없다 — 선택을 버려야 다음에 다시 물어볼 수 있다.
    await forgetSaveDir();
    throw new Error("저장 폴더를 만들지 못했어요. 폴더를 다시 선택해 주세요.");
  }
}

// 이미 정해진 저장 폴더만 돌려준다. **피커를 절대 띄우지 않는다** — 목록을
// 그리는 중에 호출되기 때문이다. iOS는 위치가 정해져 있어 되살릴 것이 없고,
// 폴더가 아직 없으면(=저장한 적 없음) 만들지 않고 null이다.
async function knownSaveDir(): Promise<Directory | null> {
  if (cachedSaveDir) {
    return cachedSaveDir.dir;
  }
  const restored = isAndroid
    ? usableDir(await readStored(SAVE_DIR_KEY))
    : usableDir(documentSaveDir().uri);
  if (!restored) {
    return null;
  }
  cachedSaveDir = toSaveDir(restored);
  return restored;
}

// 저장 폴더를 확보한다. Android는 최초 1회(또는 권한이 끊긴 뒤) SAF 피커가 뜨고,
// iOS는 앱 문서함에 바로 만든다.
async function ensureSaveDir(): Promise<SaveDir> {
  await knownSaveDir();
  if (cachedSaveDir) {
    return cachedSaveDir;
  }
  const leaf = isAndroid ? await ensureSafSaveDir() : ensureDocumentSaveDir();
  if (isAndroid) {
    // SAF 문서 ID는 불투명해 경로로 다시 가리킬 수 없다 — URI 자체를 남긴다.
    await writeStored(SAVE_DIR_KEY, leaf.uri);
  }
  cachedSaveDir = toSaveDir(leaf);
  return cachedSaveDir;
}

// 저장 전에 "저장할 폴더를 골라주세요" 안내가 필요한가. Android(SAF)에서 아직
// 폴더를 고르지 않았을 때만 true다. 화면은 이 값만 보고 분기하므로 폴더 선택이
// 어느 플랫폼 사정인지 알 필요가 없다.
export async function needsSaveFolderChoice(): Promise<boolean> {
  if (!isAndroid) {
    return false;
  }
  return (await knownSaveDir()) === null;
}

// 저장 폴더에 있는 파일 이름 집합. 메시지 목록 전체를 한 번의 목록 조회로
// 대조하라고 집합으로 준다(파일마다 exists를 부르면 SAF에서 왕복이 N번 난다).
// 아직 폴더를 고르지 않았으면 피커 없이 빈 집합.
export async function savedFileNames(): Promise<Set<string>> {
  const names = new Set<string>();
  const dir = await knownSaveDir();
  if (!dir) {
    return names;
  }
  try {
    for (const entry of dir.list()) {
      if (entry instanceof File) {
        names.add(entry.name);
      }
    }
  } catch {
    // 권한이 회수된 폴더다 — 선택을 버려 다음 저장에서 다시 고르게 한다.
    await forgetSaveDir();
  }
  return names;
}

// 이 첨부의 저장본. 없으면 null이고 아무것도 만들지 않는다(피커도 안 뜬다).
export async function savedFileFor(name: string): Promise<File | null> {
  const dir = await knownSaveDir();
  if (!dir) {
    return null;
  }
  try {
    const found = childNamed(dir, safeName(name));
    return found instanceof File ? found : null;
  } catch {
    return null;
  }
}

// 캐시 파일명에 첨부 경로(=메시지 id)를 섞어, 이름이 같은 다른 첨부가 서로를
// 덮어쓰지 않게 한다.
function cacheFileName(path: string, fileName: string): string {
  return `moneyroad-${safeName(path)}-${fileName}`;
}

// 프록시(세션 쿠키)에서 앱 캐시로 받는다. 캐시는 file:// 라 목적지로 바로 쓸 수
// 있다. 저장 폴더에는 남기지 않으므로 "저장 안 한 상태"가 유지된다.
async function downloadToCache(path: string, fileName: string): Promise<File> {
  const temp = new File(Paths.cache, cacheFileName(path, fileName));
  // Android는 응답을 목적지로 바로 스트리밍해서 실패하면 부분 파일이 남는다.
  deleteQuietly(temp);
  return await File.downloadFileAsync(mediaUrl(path), temp, {
    headers: authHeaders(),
    idempotent: true,
  });
}

/* ----(iOS 저장 — 목적지로 바로 내려받기)---- */
// 앱 문서함은 일반 파일 시스템이라 SAF와 달리 목적지로 바로 받을 수 있다
// (바이트를 한 번 더 메모리에 올리지 않는다).
async function downloadIntoDocumentDir(
  path: string,
  dir: Directory,
  fileName: string
): Promise<File> {
  const target = new File(dir, fileName);
  // 실패하면 부분 파일이 남으므로 먼저 지운다.
  deleteQuietly(target);
  return await File.downloadFileAsync(mediaUrl(path), target, {
    headers: authHeaders(),
    idempotent: true,
  });
}
/* ----(~iOS 저장 여기까지)---- */

// Download an attachment into the save folder. Returns where it landed so the
// caller can tell the user which folder to look in.
export async function downloadDiscussionFile(
  path: string,
  name: string,
  mime: string
): Promise<{ file: File; label: string }> {
  const { dir, label } = await ensureSaveDir();
  const fileName = safeName(name);
  if (!isAndroid) {
    return { file: await downloadIntoDocumentDir(path, dir, fileName), label };
  }
  // SAF 문서에는 직접 다운로드할 수 없다 — expo가 목적지의 java.io.File을 요구해서
  // content:// 목적지는 "This method cannot be used with content URIs"로 죽는다.
  // 그래서 캐시로 받은 뒤 바이트를 옮긴다(첨부 상한 20MB, 서버 FILE_MAX_BYTES).
  const temp = await downloadToCache(path, fileName);
  try {
    // createFile도 중복을 검사하지 않아 "report (1).pdf"가 늘어난다. 먼저 지운다.
    const existing = childNamed(dir, fileName);
    if (existing) {
      existing.delete();
    }
    // write()는 대상이 없으면 create()를 부르는데 create()는 SAF에서 던진다.
    // 반드시 createFile()로 먼저 만든 문서에만 쓴다.
    const target = dir.createFile(fileName, mime.length > 0 ? mime : null);
    target.write(await temp.bytes());
    return { file: target, label };
  } finally {
    deleteQuietly(temp);
  }
}

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? GENERIC_MIME;
}

// 인텐트에 넘길 타입. 서버가 mime을 모르면 확장자로 추정하고, 처리 앱이 없는
// 타입은 대체 타입으로 낮춘다.
function viewMime(name: string, mime: string): string {
  const base = mime.replace(MIME_PARAM_RE, "").trim().toLowerCase();
  const isUnknown = base.length === 0 || base === GENERIC_MIME;
  const resolved = isUnknown ? mimeFromName(name) : base;
  return VIEW_MIME_ALIASES[resolved] ?? resolved;
}

// 열기 실패는 플랫폼과 무관하게 **같은 코드**로 올린다. 화면은 "열 앱이 없다"만
// 알면 되고(→ 저장 유도, §4-5), 그게 인텐트 실패인지 공유 시트 부재인지는 모른다.
function noViewerApp(): AttachmentError {
  return new AttachmentError(
    NO_VIEWER_APP,
    "이 파일을 열 수 있는 앱이 없어요."
  );
}

/* ----(iOS 열기 — 공유 시트 / Quick Look)---- */
// expo-intent-launcher는 expo-module.config.json이 "platforms": ["android"] 라
// iOS 빌드에는 모듈 자체가 없다. iOS는 expo-sharing(UIActivityViewController)으로
// 넘겨 미리보기·다른 앱으로 열기·파일 앱 저장을 사용자가 고르게 한다.
// iOS는 mimeType을 무시하고 UTI를 보므로 아는 타입은 UTI를 같이 준다(모르면
// 생략 — 파일 확장자로 추론한다).
const UTI_BY_MIME: Record<string, string> = {
  "application/json": "public.json",
  "application/pdf": "com.adobe.pdf",
  "application/zip": "public.zip-archive",
  "audio/mpeg": "public.mp3",
  "image/gif": "com.compuserve.gif",
  "image/jpeg": "public.jpeg",
  "image/png": "public.png",
  "text/csv": "public.comma-separated-values-text",
  "text/html": "public.html",
  "text/plain": "public.plain-text",
  "video/mp4": "public.mpeg-4",
  "video/quicktime": "com.apple.quicktime-movie",
};

async function shareLocalFile(file: File, type: string): Promise<void> {
  let available = false;
  try {
    available = await isSharingAvailableAsync();
  } catch {
    available = false;
  }
  if (!available) {
    throw noViewerApp();
  }
  try {
    // 로컬 file:// 만 넘어간다 — 서버 URL·토큰은 앱 밖으로 나가지 않는다(§203).
    // 사용자가 아무것도 고르지 않고 닫으면 그냥 resolve된다(실패가 아니다).
    await shareAsync(file.uri, {
      UTI: UTI_BY_MIME[type],
      dialogTitle: file.name,
      mimeType: type,
    });
  } catch {
    throw noViewerApp();
  }
}
/* ----(~iOS 열기 여기까지)---- */

// Hand a local file to whatever app the phone has registered for its type.
// Android: contentUri는 캐시 파일(file://)이면 Expo FileProvider URI를, SAF
// 저장본이면 그 content:// 를 그대로 돌려준다. file:// 를 인텐트에 실으면
// Android가 FileUriExposedException을 던지므로 반드시 이걸 거친다.
async function openLocalFile(file: File, type: string): Promise<void> {
  if (!isAndroid) {
    await shareLocalFile(file, type);
    return;
  }
  try {
    await startActivityAsync(VIEW_ACTION, {
      data: file.contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type,
    });
  } catch {
    // 처리할 액티비티가 없으면 ActivityNotFoundException으로 reject된다.
    // 호출부가 "저장하기" 안내로 분기할 수 있게 코드를 바꿔 던진다(§4-5).
    throw noViewerApp();
  }
}

// 첨부를 폰에 설치된 앱으로 연다. 저장본이 있으면 그걸 쓰고, 없으면 앱 캐시로
// 받아서 연다(저장 폴더에는 남기지 않는다). 저장 폴더 선택 피커는 뜨지 않는다.
export async function openAttachment(
  path: string,
  name: string,
  mime: string
): Promise<void> {
  const saved = await savedFileFor(name);
  const target = saved ?? (await downloadToCache(path, safeName(name)));
  await openLocalFile(target, viewMime(name, mime));
}

// 앨범에 넣는다. 앨범은 *이름*만 넘기고 실제 경로는 OS가 정한다(경로 하드코딩
// 아님). createAlbumAsync는 같은 이름이 있어도 조회 없이 새로 만들어서(iOS는
// 컬렉션이 통째로 하나 더 생긴다) 반드시 getAlbumAsync로 먼저 찾는다.
async function putInGalleryAlbum(localUri: string): Promise<void> {
  const asset = await createAssetAsync(localUri);
  const album = await getAlbumAsync(GALLERY_ALBUM);
  if (album) {
    // copy=false → 앨범으로 옮긴다(카메라 롤 루트에 사본을 남기지 않는다).
    await addAssetsToAlbumAsync([asset], album, false);
    return;
  }
  await createAlbumAsync(GALLERY_ALBUM, asset, false);
}

// Save a DiscussionRoom image into the gallery album. Downloads to cache first
// because MediaLibrary only accepts a local file. 저장 위치는 문구로 돌려준다 —
// 사진앱 접근이 '선택한 사진만'이면 앨범을 못 써서 위치가 달라지기 때문이다.
export async function saveImageToGallery(
  path: string,
  imageId: number,
  mime: string
): Promise<{ label: string }> {
  const permission = await requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("사진 저장 권한을 허용해야 갤러리에 저장할 수 있어요.");
  }

  const ext = EXT_BY_IMAGE_MIME[mime] ?? "jpg";
  // 확장자가 있어야 사진앱이 타입을 알아본다(saveToLibraryAsync 요구사항).
  const temp = await downloadToCache(path, `image-${imageId}.${ext}`);
  try {
    if (permission.accessPrivileges === "limited") {
      // '선택한 사진만' 허용이면 앨범 조회·생성 API가 전부 거부된다(iOS는
      // 접근 권한이 'all'이 아니면 E_NO_PERMISSIONS). 저장 자체는 되므로
      // 앨범 없이 사진 보관함에 넣는다 — 저장 실패로 보이지 않게 한다.
      await saveToLibraryAsync(temp.uri);
      return { label: PHOTO_LIBRARY_LABEL };
    }
    await putInGalleryAlbum(temp.uri);
    return { label: GALLERY_ALBUM_LABEL };
  } finally {
    deleteQuietly(temp);
  }
}
/* ----(~첨부 저장·열기 여기까지)---- */
