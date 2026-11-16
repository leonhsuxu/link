/*
* FlClash Rules A1.r01 // FlClash Rules_A1.r01.js
* ===========================================================================
* 【规则集说明】
* 1. 脚本内不含任何 Emby 域名，也不声明 Emby 规则集数据。
* 2. Emby 域名由 FlClash 程序「规则集」页面维护（从零开始 / URL导入 / 文件导入均可），
*    脚本只引用规则集名称，两条引用固定不变：
*       RULE-SET,EmbyDirect,DIRECT
*       RULE-SET,EmbyProxy,🎬 Emby
* 3. 🎬 Emby 策略组完全保留，流量仍走原脚本分流的 Emby 策略组。
* 4. 以后新增域名：只在 FlClash 规则集页面编辑对应规则集，脚本无需改动。
*    规则集条目不写第三段策略名（策略由 RULE-SET 行决定）。
* 5. 原 FORCE_ALL 的「全部代理 / 全部直连」改为在客户端把 🎬 Emby 组
*    切到「🚀 节点选择」或「DIRECT」，效果等价。
* ===========================================================================
* 功能：节点自动分组，空分组自动隐藏，集成广告过滤、直连域名，节点自动测速。
*       MATCH先直连，连接不通再走代理。
*/
function main(config) {
  // ==================== 用户自定义配置 ====================
  // 是否对各地区分组内的节点进行名称排序 (true/false)
  const enableNodeSorting = true;
  // ========================================================
  if (!config.proxies) {
    config.proxies = [];
  }
  // --- 通用配置 ---
  // 用于代理组的测试地址 (确保节点能翻墙)
  const proxyTestUrl = 'http://www.gstatic.com/generate_204';
  // 用于直连优选的测试地址 (确保直连判断准确，推荐使用国内CDN地址)
  const directTestUrl = 'http://connectivitycheck.platform.hicloud.com/generate_204';
  const testInterval = 300;

  /* ====== Emby 分流：只引用程序规则集，不含域名或规则集数据 ======
     直连在前，避免同一域名被误判为需代理；
     必须放在 ACL4SSR 那批 RULE-SET 之前，否则会被 ChinaDomain / UnBan 抢先命中。 */
  const embyRules = [
    'RULE-SET,EmbyDirect,DIRECT',
    'RULE-SET,EmbyProxy,🎬 Emby'
  ];

  /* 1. 规则 */
  const rules = [
      // --- 程序分流 ---
      'PROCESS-NAME,com.mountains.hills,DIRECT', // hills app 走直连
      // --- Emby 分流（引用程序规则集，固定不动）---
      ...embyRules,
      // --- ACL4SSR 规则集 ---
      'RULE-SET,BanAD,REJECT',
      'RULE-SET,BanProgramAD,REJECT',
      'RULE-SET,TelegramList,💬 Telegram',
      'RULE-SET,YouTubeList,📺 YouTube',
      'RULE-SET,ProxyGFWlist,🚀 节点选择',
      'RULE-SET,UnBan,DIRECT',
      'GEOIP,LAN,DIRECT',
      'RULE-SET,ChinaDomain,DIRECT',
      'RULE-SET,ChinaCompanyIp,DIRECT',
      'RULE-SET,Download,DIRECT',
      'GEOIP,CN,DIRECT',
      // --- 最终匹配规则 ---
      'MATCH,🌏 直连优选'
  ];

  /* 2. 节点分组正则 (按匹配优先级排序) */
  const buckets = {
    '🇭🇰 香港': {
        regex: /香港|港|HK|Hong\s*Kong|HongKong|HKBN|HGC|PCCW|WTT|HKT|九龙|沙田|屯门|荃湾|深水埗|油尖旺/i,
        icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Hong_Kong.png'
    },
    '🇯🇵 日本': {
        regex: /日本|日|川日|东京|大阪|泉日|沪日|深日|京日|广日|JP|Japan|Tokyo|Osaka|Saitama|埼玉|名古屋|Nagoya|福冈|Fukuoka|横滨|Yokohama|NTT|IIJ|GMO|Linode/i,
        icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Japan.png'
    },
    '🇸🇬 狮城': {
        regex: /新加坡|坡|狮城|狮|新|SG|Singapore|SG\d+|SGP|星|狮子城/i,
        icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Singapore.png'
    },
    '🇺🇸 美国': {
        regex: /^(?!.*(?:aus|rus)).*(?:\b(?:us|usa|american|united states)\b|美国|美|波特兰|达拉斯|Oregon|俄勒冈|凤凰城|硅谷|拉斯维加斯|洛杉矶|圣何塞|西雅图|芝加哥|纽约|迈阿密|亚特兰大|US|USA|United\s*States|America|LA|NYC|SF|San\s*Francisco|Washington|华盛顿|Kansas|堪萨斯|Denver|丹佛|Phoenix|Seattle|Chicago|Boston|波士顿|Atlanta|Miami|Las\s*Vegas)/i,
        icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/United_States.png'
    },
    '🇹🇼 湾省': {
        regex: /台湾|湾省|台|TW|Taiwan|TWN|台北|Taipei|台中|Taichung|高雄|Kaohsiung|新北|彰化|Hinet|中华电信/i,
        icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Taiwan.png'
    },
    '🇰🇷 韩国': {
        regex: /韩国|韩|南朝鲜|首尔|釜山|仁川|KR|Korea|KOR|韓|Seoul|Busan|KT|SK|LG/i,
        icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Korea.png'
    },
    '🇩🇪 德国': {
        regex: /德国|德|法兰克福|慕尼黑|柏林|DE|Germany|Frankfurt|Munich|Berlin|Hetzner/i,
        icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Germany.png'
    },
    '🇺🇳 其他': {
        regex: /.*/,
        icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/World_Map.png'
    }
  };
  /* 3. 预处理与节点分类 */
  const groupNames = new Set(Object.keys(buckets));
  for (const proxy of config.proxies) {
    if (groupNames.has(proxy.name)) {
      proxy.name = `${proxy.name} (节点)`;
    }
  }
  const groupMap = Object.fromEntries(Object.keys(buckets).map(key => [key, []]));
  for (const proxy of config.proxies) {
    for (const [groupName, { regex }] of Object.entries(buckets)) {
      if (regex.test(proxy.name)) {
        groupMap[groupName].push(proxy.name);
        break;
      }
    }
  }
  const nonEmptyGroups = Object.entries(groupMap).filter(([, proxies]) => proxies.length > 0);
  const allAvailableProxies = nonEmptyGroups.flatMap(([, proxies]) =>
    enableNodeSorting ? proxies.slice().sort((a, b) => a.localeCompare(b)) : proxies
  );
  /* 4. 构建代理组 */
  const proxyGroups = [
    // --- 核心策略组 ---
    { name: '🚀 节点选择', type: 'select', proxies: ['♻️ 自动选择', '🔯 故障转移', 'DIRECT', ...nonEmptyGroups.map(([name]) => name)], icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Airport.png'},
    // --- 功能策略组 ---
    { name: '♻️ 自动选择', type: 'url-test', proxies: allAvailableProxies, url: proxyTestUrl, interval: testInterval, tolerance: 50, lazy: true, icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Auto.png' },
    { name: '🔯 故障转移', type: 'fallback', proxies: allAvailableProxies, url: proxyTestUrl, interval: testInterval, lazy: true, icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Loop.png' },
    { name: '🌏 直连优选', type: 'fallback', proxies: ['DIRECT', '🚀 节点选择'], url: directTestUrl, interval: testInterval, lazy: true , icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Global.png'},
    { name: '🎬 Emby', type: 'select', proxies: ['🚀 节点选择', 'DIRECT', ...nonEmptyGroups.map(([name]) => name)], icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Emby.png' },
    { name: '💬 Telegram', type: 'select', proxies: ['🚀 节点选择',  ...nonEmptyGroups.map(([name]) => name)], icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Telegram.png' },
    { name: '📺 YouTube', type: 'select', proxies: ['🚀 节点选择', ...nonEmptyGroups.map(([name]) => name)], icon: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/YouTube.png' },
    // --- 地区节点组 (自动生成) ---
    ...nonEmptyGroups.map(([name, proxies]) => {
      const sortedProxies = enableNodeSorting ? proxies.slice().sort((a, b) => a.localeCompare(b)) : proxies;
      return {
        name,
        type: 'fallback',
        proxies: sortedProxies,
        icon: buckets[name].icon,
        url: proxyTestUrl,
        interval: testInterval,
        lazy: true
      };
    })
  ];

  /* 5. 规则集提供者（仅 ACL4SSR，Emby 规则集由 FlClash 程序提供） */
  const ruleProviders = {
    BanAD: { type: 'http', behavior: 'classical', url: "https://testingcf.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/BanAD.list", path: "./ruleset/BanAD.list", interval: 86400, format: "text" },
    BanProgramAD: { type: 'http', behavior: 'classical', url: "https://testingcf.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/BanProgramAD.list", path: "./ruleset/BanProgramAD.list", interval: 86400, format: "text" },
    ProxyGFWlist: { type: 'http', behavior: 'classical', url: "https://testingcf.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/ProxyGFWlist.list", path: "./ruleset/ProxyGFWlist.list", interval: 86400, format: "text" },
    UnBan: { type: 'http', behavior: 'classical', url: "https://testingcf.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/UnBan.list", path: "./ruleset/UnBan.list", interval: 86400, format: "text" },
    ChinaDomain: { type: 'http', behavior: 'domain', url: "https://testingcf.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/ChinaDomain.list", path: "./ruleset/ChinaDomain.list", interval: 86400, format: "text" },
    ChinaCompanyIp: { type: 'http', behavior: 'ipcidr', url: "https://testingcf.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/ChinaCompanyIp.list", path: "./ruleset/ChinaCompanyIp.list", interval: 86400, format: "text" },
    Download: { type: 'http', behavior: 'classical', url: "https://testingcf.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/Download.list", path: "./ruleset/Download.list", interval: 86400, format: "text" },
    TelegramList: { type: 'http', behavior: 'classical', url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list", path: "./ruleset/Telegram.list", interval: 86400, format: "text" },
    YouTubeList: { type: 'http', behavior: 'classical', url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list", path: "./ruleset/YouTube.list", interval: 86400, format: "text" }
  };

  /* 6. 返回最终配置 */
  return { ...config, 'proxy-groups': proxyGroups, rules, 'rule-providers': ruleProviders, 'external-controller': '127.0.0.1:9090', 'secret': '' };
}
