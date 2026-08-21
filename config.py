"""JiJi Nigeria Foreign Used Cars B端车商线索抓取配置"""

BASE_URL = "https://jiji.ng"
LISTING_API = "/api_web/v1/listing"
ITEM_API = "/api_web/v1/item"
SHOP_API = "/api_web/v1/shop"
USER_ADS_API = "/api_web/v1/user"  # /{user_id}/ads 备用

START_URL = "https://jiji.ng/cars?filter_attr_100_condition=Foreign+Used"

# 抓取限速（反爬）
REQUEST_DELAY_MIN_SEC = 2.0
REQUEST_DELAY_MAX_SEC = 5.0
PAGE_DELAY_MIN_SEC = 3.0
PAGE_DELAY_MAX_SEC = 8.0
MAX_PAGES_PER_SESSION = 20
MAX_ITEMS_PER_RUN = 800
SHOP_FETCH_BATCH_PAUSE_SEC = 10.0

# 登录态持久化（Gmail 登录后自动复用 cookie）
BROWSER_STATE_DIR = "data"
BROWSER_STATE_FILE = "data/jiji_storage_state.json"
USER_DATA_DIR = "data/browser_profile"

# 数据库
DB_PATH = "data/jiji_sellers.db"

OUTPUT_DIR = "output"

# 冷触达身份：中国二手车出口，找尼日利亚批发/大型零售买家
OUTREACH_SENDER_NAME = "[Name]"
OUTREACH_COMPANY = "[Company]"
OUTREACH_ORIGIN = "China"
OUTREACH_MARKET = "Nigeria / West Africa"
OUTREACH_INCOTERM = "CIF Lagos"
OUTREACH_FROM_CHINA = True
OUTREACH_PILOT_LIMIT = 20

# 我方货盘（对外用国际车型名；锋兰达在尼日利亚按 RAV4 说）
OUTREACH_TOYOTA_MODELS = ["Highlander", "RAV4", "Camry", "Corolla"]
OUTREACH_NEV_BRANDS = ["BYD", "Geely", "Xiaomi"]

# 认证类型
PREMIUM_BADGES = {"diamond", "enterprise"}
VERIFIED_STORE_KEYWORDS = {"verified store", "store_verify", "verified address", "verified location"}
VERIFIED_ID_KEYWORDS = {"verified id", "id_verify"}

# 车商名称特征词（保留规则 R6）
DEALER_NAME_KEYWORDS = [
    "autos", "motors", "cars", "auto sales", "car dealer", "auto plaza",
    "automobile", "autoland", "autoworld", "car mart", "car hub",
    "motor world", "auto hub", "auto mart", "car sales", "auto dealer",
    "motors ltd", "motors limited", "auto ltd", "auto limited",
]

# 个人转让描述特征（排除规则 E7）
PERSONAL_TRANSFER_KEYWORDS = [
    "need money urgently", "selling my car", "personal car", "first owner",
    "used by me", "i want to sell", "reason for sale", "my own car",
    "fairly used by me", "no middleman",
]

# 阈值
RETAIN_MIN_LISTINGS = 10
EXCLUDE_MAX_LISTINGS = 3
RETAIN_MIN_YEARS = 3.0
EXCLUDE_MAX_YEARS = 1.0
