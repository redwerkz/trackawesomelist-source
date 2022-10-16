import {
  Content,
  DateTimeFormatter,
  fs,
  kebabCase,
  path,
  posixPath,
  Root,
  slug as slugFn,
  titleCase,
  toMarkdown,
  u,
  YAML,
} from "./deps.ts";
import log from "./log.ts";
import {
  BaseFeed,
  Config,
  DayInfo,
  DBMeta,
  FileConfig,
  Item,
  ItemDetail,
  ParsedFilename,
  ParsedItemsFilePath,
  RawConfig,
  RawSource,
  RawSourceFile,
  RawSourceFileWithType,
  Source,
  WeekOfYear,
} from "./interface.ts";
import {
  CONTENT_DIR,
  DEFAULT_CATEGORY,
  DEV_DOMAIN,
  INDEX_MARKDOWN_PATH,
  PROD_DOMAIN,
} from "./constant.ts";
import { NotFound } from "./error.ts";
export const SECOND = 1e3;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
const DAYS_PER_WEEK = 7;
enum Day {
  Sun,
  Mon,
  Tue,
  Wed,
  Thu,
  Fri,
  Sat,
}

export const getDayNumber = (date: Date): number => {
  return Number(
    `${getFullYear(date)}${(getFullMonth(date))}${(getFullDay(date))}`,
  );
};
export const getWeekNumber = (date: Date): number => {
  return weekOfYear(date).number;
};
export const parseDayInfo = (day: number): DayInfo => {
  const year = Math.floor(day / 10000);
  const month = Math.floor(day / 100) % 100;
  const dayNumber = day % 100;
  const date = new Date(Date.UTC(year, month - 1, dayNumber));
  const localeDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);

  return {
    year,
    id: `${year}-${addZero(month)}-${addZero(dayNumber)}`,
    name: localeDate,
    month,
    day: dayNumber,
    path: `${year}/${addZero(month)}/${addZero(dayNumber)}`,
    number: day,
    date: date,
  };
};

export function startDateOfWeek(date: Date, start_day = 1): Date {
  // Returns the start of the week containing a 'date'. Monday 00:00 UTC is
  // considered to be the boundary between adjacent weeks, unless 'start_day' is
  // specified. A Date object is returned.

  date = new Date(date.getTime());
  const day_of_month = date.getUTCDate();
  const day_of_week = date.getUTCDay();
  const difference_in_days = (
    day_of_week >= start_day
      ? day_of_week - start_day
      : day_of_week - start_day + 7
  );
  date.setUTCDate(day_of_month - difference_in_days);
  date.setUTCHours(0);
  date.setUTCMinutes(0);
  date.setUTCSeconds(0);
  date.setUTCMilliseconds(0);
  return date;
}
export const parseWeekInfo = (week: number): WeekOfYear => {
  // split by year and week
  const year = Math.floor(week / 100);
  const weekOfYear = week % 100;
  // week to date
  const date = weekNumberToDate(week);

  return {
    year,
    week: weekOfYear,
    number: week,
    path: `${year}/${weekOfYear}`,
    id: `${year}-${weekOfYear}`,
    name: weekToRange(week),
    date,
  };
};

export function weekToRange(weekNumber: number): string {
  const year = Math.floor(weekNumber / 100);
  const week = weekNumber % 100;
  // Get first day of year
  const yearStart = new Date(Date.UTC(year, 0, 1));

  // year start monday date

  const yearStartMondayDate = startDateOfWeek(yearStart);

  const yearStartMondayFullYear = yearStartMondayDate.getUTCFullYear();

  let yearFirstWeekMonday = yearStartMondayDate;
  if (yearStartMondayFullYear !== year) {
    // then year first week monday is next +7
    yearFirstWeekMonday = new Date(yearStartMondayDate.getTime() + WEEK);
  }

  const weekMonday = yearFirstWeekMonday.getTime() + WEEK * (week - 1);
  const weekSunday = weekMonday + WEEK - 1;

  const weekStartYear = new Date(weekMonday).getUTCFullYear();
  const start = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(weekMonday);

  const end = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(weekSunday);

  return `${start} - ${end}, ${weekStartYear}`;
}
export function weekNumberToDate(weekNumber: number): Date {
  const year = Math.floor(weekNumber / 100);
  const week = weekNumber % 100;
  // Get first day of year
  const yearStart = new Date(Date.UTC(year, 0, 1));

  // year start monday date

  const yearStartMondayDate = startDateOfWeek(yearStart);

  const yearStartMondayFullYear = yearStartMondayDate.getUTCFullYear();

  let yearFirstWeekMonday = yearStartMondayDate;
  if (yearStartMondayFullYear !== year) {
    // then year first week monday is next +7
    yearFirstWeekMonday = new Date(yearStartMondayDate.getTime() + WEEK);
  }

  const weekMonday = yearFirstWeekMonday.getTime() + WEEK * (week - 1);
  const weekSunday = weekMonday + WEEK - 1;
  return new Date(weekMonday);
}
export function weekOfYear(date: Date): WeekOfYear {
  const workingDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const day = workingDate.getUTCDay();

  const nearestThursday = workingDate.getUTCDate() +
    Day.Thu -
    (day === Day.Sun ? DAYS_PER_WEEK : day);

  workingDate.setUTCDate(nearestThursday);

  // Get first day of year
  const yearStart = new Date(Date.UTC(workingDate.getUTCFullYear(), 0, 1));
  const weekYear = workingDate.getUTCFullYear();
  // return the calculated full weeks to nearest Thursday
  const week = Math.ceil(
    (workingDate.getTime() - yearStart.getTime() + DAY) / WEEK,
  );
  return {
    year: weekYear,
    week: week,
    path: `${workingDate.getUTCFullYear()}/${week}`,
    number: Number(`${weekYear}${week}`),
    date: weekNumberToDate(Number(`${weekYear}${addZero(week)}`)),
    id: `${weekYear}-${week}`,
    name: weekToRange(week),
  };
}

export const addZero = function (num: number): string {
  if (num < 10) {
    return "0" + num;
  } else {
    return "" + num;
  }
};
export function getItemsDetails(items: Record<string, Item>): ItemDetail[] {
  const allItems: ItemDetail[] = [];
  for (const itemSha1 of Object.keys(items)) {
    const item = items[itemSha1];
    const updated_at = item.updated_at;

    allItems.push({
      ...item,
      updated_day: getDayNumber(new Date(updated_at)),
      updated_week: getWeekNumber(new Date(updated_at)),
      updated_day_info: parseDayInfo(getDayNumber(new Date(updated_at))),
      updated_week_info: parseWeekInfo(getWeekNumber(new Date(updated_at))),
    });
  }
  return allItems;
}
// this function is used to get the config from the config file
//
// and parse it to the right format

// return the max value of the array

export const defaultFileType = "list";
// check is dev
export function isDev() {
  return Deno.env.get("PROD") !== "1";
}
export function getDomain() {
  return isDev() ? DEV_DOMAIN : PROD_DOMAIN;
}
export function isUseCache() {
  return true;
  // return Deno.env.get("CACHE") === "1";
}
export function isMock() {
  if (isDev()) {
    return (Deno.env.get("MOCK") !== "0");
  } else {
    return false;
  }
}

export function getRepoHTMLURL(
  url: string,
  defaultBranch: string,
  file: string,
): string {
  return `${url}/blob/${defaultBranch}/${file}`;
}
export function getCachePath() {
  return path.join(Deno.cwd(), "cache");
}
export async function getConfig(): Promise<Config> {
  const rawConfig = YAML.parse(
    await Deno.readTextFile("config.yml"),
  ) as RawConfig;
  if (!rawConfig.file_min_updated_hours) {
    rawConfig.file_min_updated_hours = 12;
  }
  const config: Config = {
    ...rawConfig,
    sources: {},
  };
  for (const key of Object.keys(rawConfig.sources)) {
    const value = rawConfig.sources[key];
    config.sources[key] = getFormatedSource(key, value);
  }
  return config;
}
// https://github.com/markedjs/marked/blob/master/src/Slugger.js
export function slugy(value: string): string {
  return value
    .toLowerCase()
    .trim()
    // remove html tags
    .replace(/<[!\/a-z].*?>/ig, "")
    // remove unwanted chars
    .replace(
      /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g,
      "",
    )
    .replace(/\s/g, "-");
}
export function getIndexFileConfig(
  filesConfig: Record<string, FileConfig>,
): FileConfig {
  const keys = Object.keys(filesConfig);
  for (const key of keys) {
    const fileConfig = filesConfig[key];
    if (fileConfig.index) {
      return fileConfig;
    }
  }
  return filesConfig[keys[0]];
}

export function getAllSourceCategories(config: Config): string[] {
  const sources = config.sources;
  const sourcesKeys = Object.keys(sources);
  const categories: string[] = [];
  for (const sourceKey of sourcesKeys) {
    const source = sources[sourceKey];
    if (!categories.includes(source.category)) {
      categories.push(source.category);
    }
  }
  return categories;
}

export function getFormatedSource(
  key: string,
  value: null | RawSource | undefined,
): Source {
  let url = `https://github.com/${key}`;
  const repo = key;
  // split repo owner and repo name
  let defaultName = titleCase(key.split("/")[1]);
  let name = defaultName;
  let files: Record<string, FileConfig> = {};
  if (value) {
    if (value.url) {
      url = value.url;
    }
    if (value.files) {
      const keys = Object.keys(value.files);
      for (const fileKey of keys) {
        let fileConfig: RawSourceFileWithType;
        if (typeof value.files === "string") {
          fileConfig = formatFileConfigValue(value.files);
        } else if (value.files) {
          fileConfig = formatFileConfigValue(value.files[fileKey]);
        } else {
          fileConfig = formatFileConfigValue();
        }
        if (keys.length === 1) {
          fileConfig.index = true;
        }
        if (fileConfig.name) {
          name = fileConfig.name;
        } else {
          if (fileConfig.index) {
            name = defaultName;
          } else {
            name = `${defaultName} (${fileKey})`;
          }
        }
        files[fileKey] = {
          ...fileConfig,
          filepath: fileKey,
          pathname: `/${key}/${
            fileConfig.index ? "" : removeExtname(fileKey) +
              "/"
          }`,
          name: name,
        };
      }
      // check is has index file
      let isHasIndex = false;
      for (const rawFileKey of Object.keys(files)) {
        if (files[rawFileKey].index) {
          isHasIndex = true;
          break;
        }
      }
      if (!isHasIndex) {
        throw new Error(`source ${key} has no index file`);
      }
    } else {
      files = {
        [INDEX_MARKDOWN_PATH]: {
          filepath: INDEX_MARKDOWN_PATH,
          pathname: `/${key}/`,
          name,
          index: true,
          options: {
            type: defaultFileType,
          },
        },
      };
    }
  } else {
    // todo
    files = {
      [INDEX_MARKDOWN_PATH]: {
        filepath: INDEX_MARKDOWN_PATH,
        pathname: `/${key}/`,
        name,
        index: true,
        options: {
          type: defaultFileType,
        },
      },
    };
  }

  const defaultCategory = DEFAULT_CATEGORY;
  const sourceConfig: Source = {
    identifier: key,
    url,
    files,
    category: value?.category || defaultCategory,
  };

  if (value && value.default_branch) {
    sourceConfig.default_branch = value.default_branch;
  }
  return sourceConfig;
}
// function for format file config value
function formatFileConfigValue(
  fileValue?: string | RawSourceFile | null,
): RawSourceFileWithType {
  if (!fileValue) {
    return {
      options: { type: defaultFileType },
    };
  } else if (typeof fileValue === "string") {
    return {
      options: { type: defaultFileType },
    };
  } else {
    return {
      ...fileValue,
      options: { type: defaultFileType, ...fileValue.options },
    };
  }
}
export function getCurrentPath() {
  if (isDev()) {
    return "dev-current";
  } else {
    return "current";
  }
}

export function getDistPath() {
  if (isDev()) {
    return "dist";
  } else {
    return "prod-dist";
  }
}
export function getPublicPath() {
  if (isDev()) {
    return "public";
  } else {
    return "prod-public";
  }
}
export function getDistRepoPath() {
  return path.join(getDistPath());
}
export function getDistRepoContentPath() {
  return path.join(getDistPath(), CONTENT_DIR);
}
export function getStaticPath() {
  return "static";
}
export function getDistRepoGitUrl() {
  const envRepo = Deno.env.get("DIST_REPO");
  if (envRepo) {
    return envRepo;
  } else {
    return `git@github.com:trackawesomelist/trackawesomelist.git`;
  }
}

export function getDataRawPath() {
  return posixPath.join(getCurrentPath(), "1-raw");
}

export function getDbPath() {
  if (isDev()) {
    return "db";
  } else {
    return "prod-db";
  }
}
export function getSqlitePath() {
  return path.join(getDbPath(), "sqlite.db");
}
export function getDataItemsPath() {
  return posixPath.join(getDbPath(), "items");
}
export function getMarkdownDistPath() {
  return posixPath.join(
    getCachePath(),
    isDev() ? "dev-trackawesomelist" : "trackawesomelist",
  );
}
export async function walkFile(path: string) {
  // ensure path exists
  await fs.ensureDir(path);
  // check path exist
  return fs.walk(path, {
    includeDirs: false,
  });
}

export async function walkJSON(path: string) {
  await fs.ensureDir(path);
  return fs.walk(path, {
    includeDirs: false,
    exts: [".json"],
  });
}
export function writeTextFile(path: string, content: string) {
  return fs.ensureFile(path).then(() => {
    return Deno.writeTextFile(path, content);
  });
}
export function readTextFile(path: string) {
  return Deno.readTextFile(path);
}

export async function readJSONFile<T>(path: string): Promise<T> {
  return JSON.parse(await readTextFile(path));
}

export function parseItemsFilepath(filepath: string): ParsedItemsFilePath {
  const relativePath = path.relative(getDataItemsPath(), filepath);
  const splited = relativePath.split(path.sep);
  const sourceIdentifier = splited[0] + "/" + splited[1];
  const repoRelativeFilename = splited.slice(2).join(path.sep);
  const originalFilepath = repoRelativeFilename.slice(0, -5);
  return {
    sourceIdentifier,
    originalFilepath,
  };
}

export function parseFilename(filename: string): ParsedFilename {
  const filenameWithoutExtname = path.basename(
    filename,
    path.extname(filename),
  );
  const splited = filenameWithoutExtname.split("_");
  const type = splited[0];
  return {
    name: splited.slice(1).join("_"),
    ext: path.extname(filename),
    type,
  };
}
export function childrenToRoot(children: Content[]): Root {
  return u("root", children);
}

export function childrenToMarkdown(children: Content[]): string {
  return toMarkdown(childrenToRoot(children));
}
export async function sha1(message: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hash)); // convert buffer to byte array
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  ); // convert bytes to hex string
  return hashHex;
}
export async function exists(filename: string): Promise<boolean> {
  try {
    await Deno.stat(filename);
    // successful, file or directory must exist
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // file or directory does not exist
      return false;
    } else {
      // unexpected error, maybe permissions, pass it along
      throw error;
    }
  }
}
export function removeExtname(filename: string) {
  const extname = path.extname(filename);
  return filename.slice(0, -extname.length);
}
export function getItemsFilePath(identifier: string, file: string) {
  const itemsFilesPath = path.join(
    getDataItemsPath(),
    identifier,
    file + ".json",
  );
  return itemsFilesPath;
}
export function getDbMetaFilePath() {
  const dbMetaFilePath = path.join(
    getDbPath(),
    "meta.json",
  );
  return dbMetaFilePath;
}
export async function getDbMeta(): Promise<DBMeta> {
  // first check local
  const dbMetaFilePath = getDbMetaFilePath();
  try {
    const dbMeta = await readJSONFile(dbMetaFilePath) as DBMeta;
    return dbMeta;
  } catch (_e) {
    // not found, read from remote
    const dbMeta = await getRemoteData<DBMeta>(dbMetaFilePath);
    return dbMeta;
  }
}
export async function writeDbMeta(dbMeta: DBMeta): Promise<void> {
  // first check local
  const dbMetaFilePath = getDbMetaFilePath();
  await writeJSONFile(dbMetaFilePath, dbMeta);
}

export function getRemoteData<T>(file: string): T {
  throw new Error("not implemented");
  // return {
  //   sources: {},
  // };
}
export async function writeJSONFile(filePath: string, data: unknown) {
  const file = JSON.stringify(data, null, 2);
  // ensure dir exists
  const dir = path.dirname(filePath);
  await fs.ensureDir(dir);
  await Deno.writeTextFile(filePath, file + "\n");
}
export function getFullYear(date: Date): string {
  return date.getUTCFullYear().toString();
}
export function getFullMonth(date: Date): string {
  const month = date.getUTCMonth() + 1;
  return month < 10 ? `0${month}` : month.toString();
}

export function getFullDay(date: Date): string {
  const day = date.getUTCDate();
  return day < 10 ? `0${day}` : day.toString();
}
export function getUTCDay(date: Date): string {
  return `${getFullYear(date)}-${getFullMonth(date)}-${getFullDay(date)}`;
}
export function urlToFilePath(url: string): string {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  return pathnameToFilePath(pathname);
}
export function pathnameToFilePath(pathname: string): string {
  // is ends with /
  if (pathname.endsWith("/")) {
    return posixPath.join(
      "/",
      CONTENT_DIR,
      pathname.slice(1),
      INDEX_MARKDOWN_PATH,
    );
  } else {
    return posixPath.join("/", CONTENT_DIR, pathname.slice(1));
  }
}
export function pathnameToWeekFilePath(pathname: string): string {
  return posixPath.join(
    "/",
    CONTENT_DIR,
    pathname.slice(1),
    "week",
    INDEX_MARKDOWN_PATH,
  );
}
export function pathnameToOverviewFilePath(pathname: string): string {
  return posixPath.join(
    "/",
    CONTENT_DIR,
    pathname.slice(1),
    "readme",
    INDEX_MARKDOWN_PATH,
  );
}
export function pathnameToFeedUrl(pathname: string, isDay: boolean): string {
  const domain = getDomain();
  return domain + posixPath.join(pathname, isDay ? "" : "week", "feed.xml");
}
export async function got(
  url: string,
  init?: RequestInit,
): Promise<string> {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), 30000);
  const r = await fetch(url, { ...init, signal: c.signal });
  clearTimeout(id);

  if (r.ok) {
    return r.text();
  } else {
    throw new Error(`fetch ${url} failed with status ${r.status}`);
  }
}
export function getCachedFileInfo(
  url: string,
  method: string,
  expired: number,
): string[] {
  const urlObj = new URL(url);
  const host = urlObj.host;
  const pathname = urlObj.pathname;
  const params = urlObj.searchParams;
  const cacheFileFolder = path.join(
    getCachePath(),
    "http",
    encodeURIComponent(host),
    method,
    pathname,
    encodeURIComponent(params.toString()),
  );
  return [cacheFileFolder, (Date.now() + expired) + ".txt"];
}

export async function writeCacheFile(
  url: string,
  method: string,
  body: string,
  expired?: number,
) {
  expired = expired || 1000 * 60 * 60 * 24 * 3;
  if (isDev()) {
    expired = expired || 1000 * 60 * 60 * 24 * 30;
  }
  const [cacheFileFolder, cacheFilePath] = getCachedFileInfo(
    url,
    method,
    expired,
  );
  await writeTextFile(path.join(cacheFileFolder, cacheFilePath), body);
  return body;
}

export async function readCachedFile(
  url: string,
  method: string,
  expired = 60 * 60 * 24 * 1000,
): Promise<string> {
  // check folder is exists
  const cachedFolder = getCachedFileInfo(url, method, expired)[0];
  for await (const file of await Deno.readDir(cachedFolder)) {
    if (file.isFile && file.name.endsWith(".txt")) {
      // check is expired
      const expired = parseInt(file.name.slice(0, -4));
      const filepath = path.join(cachedFolder, file.name);

      if (Date.now() - expired < 0) {
        // not expired
        return readTextFile(filepath);
      } else {
        // expired
        await Deno.remove(filepath);
      }
    }
  }
  throw new NotFound("cached file is expired");
}
export async function gotWithCache(
  url: string,
  init?: RequestInit,
): Promise<string> {
  // check is exists cache
  let cacheFileContent;
  try {
    cacheFileContent = await readCachedFile(url, init?.method ?? "GET");
    log.debug(`use cache file for ${url}`);
  } catch (e) {
    if (e.name === "NotFound") {
      // ignore
      log.debug(`not found cache file for ${url}`);
    } else {
      throw e;
    }
  }
  if (cacheFileContent !== undefined) {
    return cacheFileContent;
  }
  const responseText = await got(url, init);
  await writeCacheFile(url, init?.method ?? "GET", responseText);
  return responseText;
}

export async function gotGithubStar(
  owner: string,
  repo: string,
): Promise<string> {
  const url = `https://img.shields.io/github/stars/${owner}/${repo}`;
  const response = await gotWithCache(url);
  const endWith = "</text></a></g></svg>";

  if (response.endsWith(endWith)) {
    const text = response.slice(0, -endWith.length);
    const start = text.lastIndexOf(">") + 1;
    const star = text.slice(start);
    return star;
  } else {
    log.debug(`got github star failed for ${owner}/${repo}`);
    return "";
  }
  // parse svg got start count
}

export async function promiseLimit<T>(
  funcs: (() => Promise<T>)[],
  limit = 1000,
): Promise<T[]> {
  let results: T[] = [];
  while (funcs.length) {
    // 100 at a time
    results = [
      ...results,
      ...await Promise.all(funcs.splice(0, limit).map((f) => f())),
    ];
    log.debug(`promise limit ${funcs.length} left`);
  }
  return results;
}
export const formatUTC = (date: Date, formatString: string) => {
  date = new Date(date.getTime() + 0 * 60 * 60 * 1000);
  const formatter = new DateTimeFormatter(formatString);
  return formatter.format(date, {
    timeZone: "UTC",
  });
};
export const formatHumanTime = (date: Date) => {
  const now = new Date();

  const nowYear = formatUTC(now, "yyyy");
  const dateYear = formatUTC(date, "yyyy");
  const isThisYear = nowYear === dateYear;

  if (isThisYear) {
    return formatUTC(date, "MM/dd");
  } else {
    return formatUTC(date, "yy/MM/dd");
  }
};
export const formatNumber = (num: number): string => {
  const formatter = Intl.NumberFormat("en", { notation: "compact" });
  return formatter.format(num);
};

export function getBaseFeed(): BaseFeed {
  const domain = getDomain();
  return {
    version: "https://jsonfeed.org/version/1",
    icon: `${domain}/icon.png`,
    favicon: `${domain}/favicon.ico`,
    language: "en",
  };
}
export const slug = function (tag: string): string {
  // @ts-ignore: npm module
  return slugFn(kebabCase(tag));
};