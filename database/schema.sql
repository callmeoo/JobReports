-- JiJi Nigeria Foreign Used Cars — B端车商线索库
-- 用于卖家画像、B端评分、商务拓客匹配

PRAGMA foreign_keys = ON;

-- 抓取批次记录
CREATE TABLE IF NOT EXISTS scrape_runs (
    id              TEXT PRIMARY KEY,           -- UUID / 时间戳批次号
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at     TEXT,
    source_url      TEXT NOT NULL,
    pages_scraped   INTEGER DEFAULT 0,
    listings_seen   INTEGER DEFAULT 0,
    sellers_qualified INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'running',     -- running | completed | failed
    notes           TEXT
);

-- B端车商主表（卖家画像基础）
CREATE TABLE IF NOT EXISTS seller_leads (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 身份
    jiji_user_id            INTEGER UNIQUE,
    shop_slug               TEXT,
    company_name            TEXT NOT NULL,
    seller_profile_url      TEXT,

    -- 认证类型（布尔标记 + 汇总 JSON）
    cert_diamond            INTEGER NOT NULL DEFAULT 0,
    cert_enterprise         INTEGER NOT NULL DEFAULT 0,
    cert_verified_store     INTEGER NOT NULL DEFAULT 0,
    cert_verified_id        INTEGER NOT NULL DEFAULT 0,
    certification_types     TEXT,               -- JSON: ["Diamond","Enterprise"]

    -- 注册年限
    member_since_label      TEXT,               -- "3+ years on Jiji" / "5 y 8 m"
    member_years            REAL,

    -- 店铺信息
    shop_address            TEXT,
    city                    TEXT,
    state_region            TEXT,
    business_hours          TEXT,
    shop_description        TEXT,

    -- 经营信号
    response_time           TEXT,               -- "Typically replies within minutes"
    feedback_count          INTEGER DEFAULT 0,
    listing_count           INTEGER DEFAULT 0,
    foreign_used_count      INTEGER DEFAULT 0,
    is_foreign_used_focus   INTEGER NOT NULL DEFAULT 1,

    -- 车源结构
    top_brands              TEXT,               -- JSON Top3: ["Toyota","Lexus","Mercedes-Benz"]
    top_models              TEXT,               -- JSON Top5
    price_min               INTEGER,
    price_max               INTEGER,
    price_median            INTEGER,
    price_distribution      TEXT,               -- JSON: {"0-5M":12,"5-10M":8,...}

    -- 样本链接
    sample_listing_urls     TEXT,               -- JSON array, max 5
    latest_posted_at        TEXT,

    -- 卖家画像（不参与评分）
    brand_segments          TEXT,               -- JSON: ["日系","豪华车"]
    price_band              TEXT,               -- 主营价格带: "10-20M ₦"

    -- 筛选审计（便于调规则 & 后续评分）
    retain_reasons          TEXT,               -- JSON: ["R1_diamond","R5_listings_10+"]
    exclude_flags           TEXT,               -- JSON: 触发的排除项（若有豁免则记录）
    dealer_keyword_hits     TEXT,               -- JSON: 命中的车商词
    is_qualified            INTEGER NOT NULL DEFAULT 0,

    -- B端评分预留（后续画像模块写入）
    b_end_score             REAL,
    score_breakdown         TEXT,               -- JSON

    -- 人工联络方式（评分后由业务人员填写，抓取阶段不采集）
    contact_whatsapp        TEXT,
    contact_phone           TEXT,
    contact_email           TEXT,
    contact_notes           TEXT,
    contact_added_at        TEXT,
    contact_added_by        TEXT,

    -- 元数据
    first_seen_at           TEXT NOT NULL DEFAULT (datetime('now')),
    last_scraped_at         TEXT NOT NULL DEFAULT (datetime('now')),
    last_scrape_run_id      TEXT,
    updated_at              TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (last_scrape_run_id) REFERENCES scrape_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_seller_city ON seller_leads(city);
CREATE INDEX IF NOT EXISTS idx_seller_qualified ON seller_leads(is_qualified);
CREATE INDEX IF NOT EXISTS idx_seller_listing_count ON seller_leads(listing_count DESC);
CREATE INDEX IF NOT EXISTS idx_seller_cert ON seller_leads(cert_diamond, cert_enterprise, cert_verified_store);
CREATE INDEX IF NOT EXISTS idx_seller_score ON seller_leads(b_end_score DESC);

-- 卖家-车源明细（支撑品牌/车型/价格聚合 & 后续评分）
CREATE TABLE IF NOT EXISTS seller_listings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_lead_id  INTEGER NOT NULL,
    jiji_listing_id INTEGER NOT NULL,
    listing_url     TEXT,
    title           TEXT,
    brand           TEXT,
    model           TEXT,
    year            INTEGER,
    condition       TEXT,                       -- Foreign Used / Nigerian Used / Brand New
    price           INTEGER,
    region          TEXT,
    posted_at       TEXT,
    scraped_at      TEXT NOT NULL DEFAULT (datetime('now')),
    scrape_run_id   TEXT,

    UNIQUE(jiji_listing_id),
    FOREIGN KEY (seller_lead_id) REFERENCES seller_leads(id) ON DELETE CASCADE,
    FOREIGN KEY (scrape_run_id) REFERENCES scrape_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_listing_seller ON seller_listings(seller_lead_id);
CREATE INDEX IF NOT EXISTS idx_listing_brand ON seller_listings(brand);
CREATE INDEX IF NOT EXISTS idx_listing_condition ON seller_listings(condition);

-- B端评分表（卖家画像输出，后续模块填充）
CREATE TABLE IF NOT EXISTS seller_scores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_lead_id  INTEGER NOT NULL UNIQUE,
    scored_at       TEXT NOT NULL DEFAULT (datetime('now')),
    total_score     REAL NOT NULL,
    tier            TEXT,                       -- KEY / FOLLOW / WATCH / LOW
    cert_score      REAL,
    tenure_score    REAL,
    inventory_score REAL,
    brand_score     REAL,
    trust_score     REAL,
    engagement_score REAL,
    score_detail    TEXT,                       -- JSON 评分明细
    notes           TEXT,

    FOREIGN KEY (seller_lead_id) REFERENCES seller_leads(id) ON DELETE CASCADE
);
