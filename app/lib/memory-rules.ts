/**
 * Memory Engine - 离线规则引擎
 *
 * 在 AI 未接入时，使用规则匹配完成记忆分类。
 * 所有规则使用正则表达式匹配用户输入。
 */

import type { MemoryType, Risk, KnowledgeNode } from "./types.ts";
import type { LearningEvent } from "./events.ts";

export type MemoryRule = {
  /** 正则模式 */
  pattern: RegExp;
  /** 匹配后的记忆类型 */
  type: MemoryType | "short_term" | "discard";
  /** AI 置信度 0-100 */
  confidence: number;
  /** 规则说明 */
  description: string;
};

/** 规则匹配结果 */
export type MatchResult = {
  matched: boolean;
  type: MemoryType | "short_term" | "discard";
  confidence: number;
  matchedText: string;
  ruleDescription: string;
};

/**
 * 记忆分类规则集
 *
 * 优先级排序：
 * 1. discard（丢弃规则优先，避免误分类）
 * 2. long_term（长期记忆）
 * 3. short_term（短期记忆兜底）
 */
export const MEMORY_RULES: MemoryRule[] = [
  // ════════════════════════════════════════════════════════════
  // 丢弃规则（最高优先级）
  // ════════════════════════════════════════════════════════════
  {
    pattern: /吃了|睡了|天气|好玩|哈哈|笑了|开心/,
    type: "discard",
    confidence: 90,
    description: "日常闲聊，无学习信息",
  },
  {
    pattern: /加载|报错|打不开|卡住|闪退/,
    type: "discard",
    confidence: 85,
    description: "技术故障/操作问题",
  },

  // ════════════════════════════════════════════════════════════
  // 长期记忆规则
  // ════════════════════════════════════════════════════════════

  // 学习目标
  {
    pattern: /(目标|希望|打算|计划).*[分考学]|想考|要考(到)?\d/,
    type: "goal",
    confidence: 80,
    description: "明确表达学习目标或分数期望",
  },
  {
    pattern: /(第一志愿|保底|调剂|上岸)/,
    type: "goal",
    confidence: 75,
    description: "涉及考研目标院校或期望",
  },

  // 学习习惯
  {
    pattern: /(只有|每晚|每天.*?[早中晚]|周末|工作日)(才能|会|可以|有时间)/,
    type: "habit",
    confidence: 75,
    description: "固定的学习时间安排",
  },
  {
    pattern: /(习惯|总是|每次.*?[先后])(做|学|看|读)/,
    type: "habit",
    confidence: 70,
    description: "稳定的学习顺序习惯",
  },
  {
    pattern: /(在|是)(职|工作|上班|学生|在校)/,
    type: "background",
    confidence: 85,
    description: "个人背景信息",
  },

  // 知识弱点
  {
    pattern: /(容易|总是|经常|每次).*?(错|算|忘|混|丢)/,
    type: "weakness",
    confidence: 80,
    description: "重复性错误模式",
  },
  {
    pattern: /(最\w*难|薄弱|不会|不懂|没掌握)/,
    type: "weakness",
    confidence: 70,
    description: "明确的知识弱点",
  },
  {
    pattern: /(计算|公式|概念|定理|推导).*?(错|忘|混|不会)/,
    type: "weakness",
    confidence: 75,
    description: "针对特定知识类型的困难",
  },

  // 学习偏好
  {
    pattern: /(喜欢|偏好|倾向于|习惯先)(做|学|看|读|练)/,
    type: "preference",
    confidence: 70,
    description: "学习方式偏好",
  },
  {
    pattern: /(不喜欢|讨厌|排斥|不想)(做|学|看|读|练)/,
    type: "preference",
    confidence: 65,
    description: "负面学习偏好",
  },

  // 情绪模式
  {
    pattern: /(焦虑|紧张|压力|崩溃|受不了|累|疲惫)/,
    type: "emotion_pattern",
    confidence: 60,
    description: "负面情绪表达（可能为模式）",
  },
  {
    pattern: /每[到逢]?(月底|考前|周末|周一)/,
    type: "emotion_pattern",
    confidence: 55,
    description: "周期性情绪模式",
  },

  // 行为模式
  {
    pattern: /(拖延|走神|分心|集中不了|专注不了)/,
    type: "behavior_pattern",
    confidence: 70,
    description: "注意力/拖延问题",
  },
  {
    pattern: /(最后|后半段|接下来).*(分钟|小时).*(效率|学不进|走神)/,
    type: "behavior_pattern",
    confidence: 65,
    description: "特定时段的效率问题",
  },
  {
    pattern: /(超额|没完成|延期|拖了)/,
    type: "behavior_pattern",
    confidence: 60,
    description: "任务完成模式",
  },

  // ════════════════════════════════════════════════════════════
  // 短期记忆规则（用于复盘结构化提取）
  // ════════════════════════════════════════════════════════════
  {
    pattern: /今天.*(完成|学了|做了|看了|读了)/,
    type: "short_term",
    confidence: 70,
    description: "今日已完成内容",
  },
  {
    pattern: /明天.*(要|打算|计划|准备)/,
    type: "short_term",
    confidence: 60,
    description: "明日计划",
  },
  {
    pattern: /(困难|卡住|不会|想不通|不理解).*(题|知识点|概念|公式)/,
    type: "short_term",
    confidence: 65,
    description: "当日具体困难",
  },
  {
    pattern: /(花了|用了|学了).*(\d+.*[小时分钟])/,
    type: "short_term",
    confidence: 60,
    description: "学习时长记录",
  },
];

/**
 * 对单条输入执行规则匹配
 * 返回置信度最高的匹配结果
 */
export function classifyMemory(input: string): MatchResult {
  const noMatch: MatchResult = {
    matched: false,
    type: "short_term", // 默认归为短期
    confidence: 30,
    matchedText: "",
    ruleDescription: "无规则匹配，默认短期记忆",
  };

  if (!input || input.trim().length === 0) {
    return noMatch;
  }

  let bestMatch: MatchResult = noMatch;

  for (const rule of MEMORY_RULES) {
    const match = input.match(rule.pattern);
    if (match) {
      // discard 规则优先
      if (rule.type === "discard") {
        return {
          matched: true,
          type: "discard",
          confidence: rule.confidence,
          matchedText: match[0],
          ruleDescription: rule.description,
        };
      }

      // 长期记忆优先于短期记忆
      const isLongTerm = rule.type !== "short_term";
      const currentIsLongTerm =
        bestMatch.type !== "short_term" && bestMatch.type !== "discard";

      if (
        !bestMatch.matched ||
        rule.confidence > bestMatch.confidence ||
        (isLongTerm && !currentIsLongTerm)
      ) {
        bestMatch = {
          matched: true,
          type: rule.type,
          confidence: rule.confidence,
          matchedText: match[0],
          ruleDescription: rule.description,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * 从用户输入中批量提取记忆
 */
export function extractMemories(
  input: string,
  sourceId: string
): {
  longTerm: string[];
  shortTerm: string[];
  discard: boolean;
} {
  const lines = input.split(/[，。！？\n，。！？、]/).filter(Boolean);
  const result = {
    longTerm: [] as string[],
    shortTerm: [] as string[],
    discard: false,
  };

  for (const line of lines) {
    const classification = classifyMemory(line);
    if (classification.type === "discard") {
      result.discard = true;
      continue;
    }
    if (
      classification.type !== "short_term" &&
      classification.matched
    ) {
      result.longTerm.push(line);
    } else if (classification.matched || classification.type === "short_term") {
      result.shortTerm.push(line);
    }
  }

  return result;
}

/**
 * 从复盘输入中提取结构化字段
 */
export function extractReviewFields(rawInput: {
  done: string;
  hard: string;
  overload: string;
  availableTime: string;
  priority: string;
}): {
  content: string[];
  difficulty: string[];
  availableMinutes: number;
  loadLevel: "过少" | "刚好" | "过多";
} {
  // 从 "done" 字段提取学习内容
  const content = rawInput.done
    .split(/[，,、]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 从 "hard" 字段提取困难知识点
  const difficulty = rawInput.hard
    .split(/[，,、]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 从 "availableTime" 字段提取可用分钟数
  const timeMatch = rawInput.availableTime.match(/(\d+\.?\d*)/);
  const availableMinutes = timeMatch
    ? Math.round(parseFloat(timeMatch[1]) * 60)
    : 0;

  // 从 "overload" 字段判断负荷
  const loadLevel: "过少" | "刚好" | "过多" = (() => {
    if (/少|不够|轻松/.test(rawInput.overload)) return "过少";
    if (/多|重|累|满/.test(rawInput.overload)) return "过多";
    return "刚好";
  })();

  return {
    content,
    difficulty,
    availableMinutes,
    loadLevel,
  };
}

/** 检查输入是否已存在于记忆中（去重） */
export function isDuplicateMemory(
  existingMemories: { content: string }[],
  input: string
): boolean {
  const normalized = input.trim().toLowerCase();
  return existingMemories.some((m) => {
    const existing = m.content.toLowerCase();
    return (
      existing.includes(normalized) || normalized.includes(existing)
    );
  });
}

/** 生成记忆 ID */
export function generateMemoryId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ════════════════════════════════════════════════════════════
// Sprint 2A: Knowledge Projection 规则引擎
// ════════════════════════════════════════════════════════════
// 所有知识状态投影规则统一收口在此文件。
// projectKnowledgeState() 不得内联业务规则，只能调用本引擎。
// 这样修改算法时只需改规则集，无需改投影函数。
// ════════════════════════════════════════════════════════════

/** 投影规则结果 */
export type ProjectionApplyResult = {
  /** 投影后的掌握度（0-100，clamp） */
  masteryScore: number;
  /** 掌握层级（0-4，clamp） */
  masteryLevel: number;
  /** 错题计数 */
  mistakes: number;
  /** 复习计数 */
  reviewCount: number;
  /** 遗忘风险（0-100，clamp） */
  forgetRisk: number;
  /** 复习风险 */
  reviewRisk: Risk;
};

/** 当前节点的投影累计摘要（不含具体影响哪个事件，由 projection 层跟踪 sourceEventId） */
export type KnowledgeProjectionAccumulator = {
  masteryScore: number;
  masteryLevel: number;
  mistakes: number;
  reviewCount: number;
  forgetRisk: number;
  reviewRisk: Risk;
};

/**
 * 投影规则集。
 * 每个规则函数输入：事件 + 当前节点投影 + 累积器 → 返回更新后的累积器与风险。
 * 规则必须为纯函数（无副作用、无 Date.now / Math.random / 全局读）。
 */
export const KNOWLEDGE_PROJECTION_RULES = {
  /** 处理一条对某节点生效的事件 */
  applyEvent: (
    acc: KnowledgeProjectionAccumulator,
    event: LearningEvent,
    node: Pick<KnowledgeNode, "masteryScore" | "mistakes">
  ): KnowledgeProjectionAccumulator => {
    let { masteryScore, masteryLevel, mistakes, reviewCount, forgetRisk } = acc;

    if (event.type === "question_answered") {
      if (event.payload.result === "错误") {
        // 做错题：掌握度 -8，错题 +1，遗忘风险 +10
        mistakes += 1;
        masteryScore = Math.max(0, masteryScore - 8);
        masteryLevel = masteryLevel > 0 ? masteryLevel - 1 : 0;
        forgetRisk = Math.min(100, forgetRisk + 10);
      } else if (event.payload.result === "正确") {
        // 做对题：掌握度 +5
        masteryScore = Math.min(100, masteryScore + 5);
        forgetRisk = Math.max(0, forgetRisk - 5);
      }
    } else if (event.type === "card_reviewed") {
      // 卡片复习：复习计数 +1，按掌握档位调整掌握度
      reviewCount += 1;
      const mastery = event.payload.mastery;
      if (mastery === "不会") {
        masteryScore = Math.max(0, masteryScore - 2);
        masteryLevel = masteryLevel > 0 ? masteryLevel - 1 : 0;
        forgetRisk = Math.min(100, forgetRisk + 15);
      } else if (mastery === "模糊") {
        masteryScore = Math.max(0, masteryScore + 2);
        forgetRisk = Math.min(100, forgetRisk + 8);
      } else if (mastery === "认识") {
        masteryScore = Math.min(100, masteryScore + 5);
        forgetRisk = Math.max(0, forgetRisk - 10);
      } else if (mastery === "熟练") {
        masteryScore = Math.min(100, masteryScore + 8);
        forgetRisk = Math.max(0, forgetRisk - 20);
      } else if (mastery === "稳定") {
        masteryScore = Math.min(100, masteryScore + 12);
        forgetRisk = Math.max(0, forgetRisk - 30);
      }
    } else if (event.type === "study_completed" && node && event.payload.accuracy !== undefined) {
      // 任务完成且正确率 < 60：掌握度 -8（与旧逻辑一致）
      if (event.payload.accuracy < 60) {
        masteryScore = Math.max(0, masteryScore - 8);
        masteryLevel = masteryLevel > 0 ? masteryLevel - 1 : 0;
        forgetRisk = Math.min(100, forgetRisk + 10);
      } else {
        // 正确率 >= 60：掌握度 +5
        masteryScore = Math.min(100, masteryScore + 5);
        forgetRisk = Math.max(0, forgetRisk - 5);
      }
    }

    // 推导风险等级
    let reviewRisk: Risk = acc.reviewRisk;
    if (masteryScore < 30) reviewRisk = "高风险";
    else if (masteryScore < 50) reviewRisk = "需要关注";
    else reviewRisk = "正常";

    return {
      masteryScore,
      masteryLevel,
      mistakes,
      reviewCount,
      forgetRisk,
      reviewRisk,
    };
  },

  /** 初始化累积器：以节点当前状态为起点 */
  createInitialAccumulator: (
    node: Pick<KnowledgeNode, "masteryScore" | "mistakes" | "masteryLevel">
  ): KnowledgeProjectionAccumulator => ({
    masteryScore: node.masteryScore,
    masteryLevel: node.masteryLevel,
    mistakes: node.mistakes,
    reviewCount: 0,
    forgetRisk: 0,
    reviewRisk: node.masteryScore < 30 ? "高风险" : node.masteryScore < 50 ? "需要关注" : "正常",
  }),
} as const;
