import { type LearningTask, STORY_STAGES, STAGE_LEARNING_TASKS } from "./story";
import { type HallTier } from "./hall-of-fame";

export type IncorrectTaskRecord = {
  stageId: number;
  taskId: string;
  task: LearningTask;
  wrongAnswers: string[];
  timestamp: number;
};

export type SimilarTask = {
  prompt: string;
  context: string;
  options?: string[];
  answer: string;
  explanation: string;
};

export type ReviewProblemItem = {
  index: number;
  stageId: number;
  lesson: string;
  place: string;
  originalTask: LearningTask;
  similarTask: SimilarTask;
};

export type WorksheetReport = {
  studentName: string;
  tier: HallTier;
  attempts: number;
  rankText: string;
  certificateNumber: string;
  issuedAt: string;
  totalIncorrectCount: number;
  isPerfectScore: boolean;
  problems: ReviewProblemItem[];
};

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

export function getDivisors(n: number): number[] {
  const result: number[] = [];
  for (let i = 1; i <= n; i += 1) {
    if (n % i === 0) result.push(i);
  }
  return result;
}

export function getCommonDivisors(a: number, b: number): number[] {
  const g = gcd(a, b);
  return getDivisors(g);
}

export function generateSimilarTask(task: LearningTask): SimilarTask {
  const id = task.id;

  // 1. Divisors of N
  if (id === "divisors-of-20" || id === "review-divisors" || id === "boss-divisor") {
    const target = id === "divisors-of-20" ? 28 : id === "review-divisors" ? 48 : 36;
    const divisors = getDivisors(target);
    const distractors = target === 28 ? [3, 5, 8] : target === 48 ? [5, 9, 14] : [5, 8, 10];
    const allOptions = Array.from(new Set([...divisors, ...distractors])).sort((a, b) => a - b);
    return {
      prompt: `${target}의 약수를 모두 고르세요.`,
      context: `${target}을 나누었을 때 나누어떨어지는 수를 빠짐없이 찾아보세요.`,
      options: allOptions.map(String),
      answer: divisors.join(", "),
      explanation: `${target}의 약수는 ${divisors.join(", ")}입니다.`,
    };
  }

  // 2. Number from divisors
  if (id === "number-from-divisors") {
    return {
      prompt: "약수가 1, 3, 5, 15인 수는 어느 것인가요?",
      context: "어떤 수의 약수를 모두 나타낸 것을 보고 원래 수를 찾아보세요.",
      options: ["10", "15", "20", "30"],
      answer: "15",
      explanation: "15를 나누어떨어지게 하는 수는 1, 3, 5, 15이므로 정답은 15입니다.",
    };
  }

  // 3. Divisor / Multiple pairs
  if (id === "divisor-pairs") {
    return {
      prompt: "왼쪽 수가 오른쪽 수의 약수인 것을 모두 고르세요.",
      context: "두 수를 나누어 나머지가 0인지 확인하세요.",
      options: ["7과 49", "6과 38", "8과 64", "15과 40"],
      answer: "7과 49, 8과 64",
      explanation: "49÷7=7, 64÷8=8로 나누어떨어집니다. 6은 38의 약수가 아니고 15는 40의 약수가 아닙니다.",
    };
  }

  // 4. Word problem - sharing bags / items
  if (id === "orange-bag-count") {
    const num = 36;
    const count = getDivisors(num).length;
    return {
      prompt: `초콜릿 ${num}개를 여러 봉지에 남김없이 똑같이 나누어 담는 방법은 모두 몇 가지인가요?`,
      context: `봉지 수가 될 수 있는 ${num}의 약수를 모두 찾아 개수를 세어 보세요.`,
      answer: `${count}가지 (${getDivisors(num).join(", ")})`,
      explanation: `${num}의 약수는 ${getDivisors(num).join(", ")}로 총 ${count}개이므로 ${count}가지입니다.`,
    };
  }

  // 5. Multiples list
  if (id === "multiples-of-9") {
    return {
      prompt: "7의 배수를 가장 작은 수부터 차례로 5개 쓴 것은 어느 것인가요?",
      context: "7에 1, 2, 3, 4, 5를 차례로 곱해 보세요.",
      options: ["7, 14, 21, 28, 35", "7, 13, 20, 27, 34", "1, 7, 14, 21, 28"],
      answer: "7, 14, 21, 28, 35",
      explanation: "7×1=7, 7×2=14, 7×3=21, 7×4=28, 7×5=35입니다.",
    };
  }

  // 6. Multiples selection
  if (id === "multiples-of-12" || id === "boss-multiple-selection") {
    const base = id === "multiples-of-12" ? 15 : 8;
    const correct = [base * 2, base * 3, base * 5, base * 6];
    const incorrect = [base * 2 + 3, base * 4 - 2, base * 7 + 1];
    const opts = Array.from(new Set([...correct, ...incorrect])).sort((a, b) => a - b);
    return {
      prompt: `다음 수 중 ${base}의 배수를 모두 고르세요.`,
      context: `각 수가 ${base}×자연수로 나누어떨어지는지 확인하세요.`,
      options: opts.map(String),
      answer: correct.sort((a, b) => a - b).join(", "),
      explanation: `${correct.sort((a, b) => a - b).map((c) => `${c}=${base}×${c / base}`).join(", ")}이므로 ${base}의 배수입니다.`,
    };
  }

  // 7. Largest 2-digit multiple
  if (id === "largest-two-digit-multiple") {
    return {
      prompt: "13의 배수 중 가장 큰 두 자리 수를 쓰세요.",
      context: "13의 배수를 차례로 구해 100보다 작은 마지막 수를 찾으세요.",
      answer: "91",
      explanation: "13×7=91이고 13×8=104이므로 가장 큰 두 자리 배수는 91입니다.",
    };
  }

  // 8. Bus departure
  if (id === "bus-fifth-departure") {
    return {
      prompt: "버스가 오전 8시부터 15분 간격으로 출발합니다. 4번째 버스는 몇 시 몇 분에 출발하나요?",
      context: "첫 버스가 오전 8시에 출발하므로 15분을 세 번 더해 보세요.",
      answer: "오전 8시 45분",
      explanation: "4번째 버스는 처음 출발 후 15×3=45분 뒤이므로 오전 8시 45분입니다.",
    };
  }

  // 9. Common divisors
  if (id === "common-divisors" || id === "boss-common-divisors") {
    const a = id === "common-divisors" ? 24 : 36;
    const b = id === "common-divisors" ? 36 : 48;
    const comm = getCommonDivisors(a, b);
    const dist = [5, 7, 10, 15];
    const opts = Array.from(new Set([...comm, ...dist])).sort((x, y) => x - y);
    return {
      prompt: `${a}와 ${b}의 공약수를 모두 고르세요.`,
      context: "두 수를 모두 나누어떨어지게 하는 수만 선택하세요.",
      options: opts.map(String),
      answer: comm.join(", "),
      explanation: `${a}와 ${b}의 공약수는 ${comm.join(", ")}입니다. (최대공약수 ${gcd(a, b)}의 약수)`,
    };
  }

  // 10. Greatest common divisor
  if (id === "greatest-common-divisor") {
    return {
      prompt: "24와 36의 최대공약수는 어느 것인가요?",
      context: "두 수의 공약수 1, 2, 3, 4, 6, 12 중 가장 큰 수를 찾으세요.",
      options: ["4", "6", "12", "18"],
      answer: "12",
      explanation: "24와 36의 공약수 중 가장 큰 수는 12입니다.",
    };
  }

  // 11. Common divisors from GCD
  if (id === "common-divisors-from-gcd") {
    return {
      prompt: "어떤 두 수의 최대공약수가 30입니다. 두 수의 공약수가 될 수 있는 수를 모두 고르세요.",
      context: "두 수의 공약수는 최대공약수 30의 약수와 같습니다.",
      options: ["2", "4", "5", "6", "8", "10", "15"],
      answer: "2, 5, 6, 10, 15",
      explanation: "2, 5, 6, 10, 15는 30의 약수이므로 공약수가 될 수 있습니다. 4와 8은 30의 약수가 아닙니다.",
    };
  }

  // 12. Common divisor count
  if (id === "common-divisor-count") {
    return {
      prompt: "36과 48의 공약수는 모두 몇 개인가요?",
      context: "두 수의 최대공약수 12를 구한 뒤 약수의 개수를 세어 보세요.",
      answer: "6개",
      explanation: "36과 48의 최대공약수는 12이고, 12의 약수는 1, 2, 3, 4, 6, 12로 총 6개입니다.",
    };
  }

  // 13. GCD factorization formula
  if (id === "gcd-factorization") {
    return {
      prompt: "30=2×3×5, 45=3×3×5일 때 최대공약수를 구하는 식은 어느 것인가요?",
      context: "두 곱셈식에 공통으로 들어 있는 수를 한 번씩 곱하세요.",
      options: ["3×5=15", "2×3×5=30", "2×3×3×5=90"],
      answer: "3×5=15",
      explanation: "두 수에 공통으로 들어 있는 수는 3과 5이므로 최대공약수는 3×5=15입니다.",
    };
  }

  // 14. GCD division path
  if (id === "gcd-division-path") {
    return {
      prompt: "36과 54를 공약수로 계속 나눈 올바른 과정은 어느 것인가요?",
      context: "두 수를 공약수로 나누어 몫이 서로소가 될 때까지 계산하세요.",
      options: ["36, 54 ÷ 2 → 18, 27 ÷ 9 → 2, 3", "36, 54 ÷ 4 → 9, 13", "36, 54 ÷ 6 → 6, 8"],
      answer: "36, 54 ÷ 2 → 18, 27 ÷ 9 → 2, 3",
      explanation: "36과 54는 2로 나눈 뒤 다시 9(또는 3을 두 번)로 함께 나눌 수 있어 최대공약수는 2×9=18입니다.",
    };
  }

  // 15. Short answer GCD
  if (id === "gcd-72-90" || id === "review-gcd-short" || id === "boss-gcd-short") {
    const a = id === "gcd-72-90" ? 48 : id === "review-gcd-short" ? 56 : 72;
    const b = id === "gcd-72-90" ? 64 : id === "review-gcd-short" ? 84 : 108;
    const g = gcd(a, b);
    return {
      prompt: `${a}와 ${b}의 최대공약수를 쓰세요.`,
      context: "두 수를 공약수로 계속 나누어 최대공약수를 구하세요.",
      answer: String(g),
      explanation: `${a}와 ${b}의 최대공약수는 ${g}입니다.`,
    };
  }

  // 16. Sharing students GCD word problem
  if (id === "gcd-sharing-students" || id === "review-sharing-short") {
    const a = id === "gcd-sharing-students" ? 36 : 45;
    const b = id === "gcd-sharing-students" ? 48 : 60;
    const g = gcd(a, b);
    return {
      prompt: `빵 ${a}개와 음료수 ${b}개를 최대한 많은 학생에게 남김없이 똑같이 나누어 주려고 합니다. 최대 몇 명에게 줄 수 있나요?`,
      context: "두 수의 최대공약수를 구하세요.",
      answer: `${g}명`,
      explanation: `${a}와 ${b}의 최대공약수는 ${g}이므로 최대 ${g}명에게 똑같이 나누어 줄 수 있습니다.`,
    };
  }

  // 17. Common multiples
  if (id === "common-multiples") {
    return {
      prompt: "100보다 작은 6과 9의 공배수를 모두 고르세요.",
      context: "6과 9의 최소공배수는 18입니다. 18의 배수를 찾으세요.",
      options: ["18", "27", "36", "45", "54", "72", "90", "96"],
      answer: "18, 36, 54, 72, 90",
      explanation: "6과 9의 최소공배수는 18이므로 100보다 작은 공배수는 18, 36, 54, 72, 90입니다.",
    };
  }

  // 18. Least common multiple
  if (id === "least-common-multiple") {
    return {
      prompt: "6과 9의 최소공배수는 어느 것인가요?",
      context: "공배수 18, 36, 54... 중 가장 작은 수를 고르세요.",
      options: ["12", "18", "27", "36"],
      answer: "18",
      explanation: "6과 9의 공배수 중 가장 작은 수는 18입니다.",
    };
  }

  // 19. Common multiples from LCM
  if (id === "common-multiples-from-lcm") {
    return {
      prompt: "어떤 두 수의 최소공배수가 14입니다. 두 수의 공배수를 모두 고르세요.",
      context: "두 수의 공배수는 최소공배수 14의 배수입니다.",
      options: ["14", "21", "28", "42", "50", "70"],
      answer: "14, 28, 42, 70",
      explanation: "14, 28, 42, 70은 14의 배수이므로 두 수의 공배수입니다. 21과 50은 14의 배수가 아닙니다.",
    };
  }

  // 20. Two digit common multiple count
  if (id === "two-digit-common-multiple-count") {
    return {
      prompt: "4와 6의 공배수 중 두 자리 수는 모두 몇 개인가요?",
      context: "4와 6의 최소공배수 12부터 99 이하인 12의 배수 개수를 세어 보세요.",
      answer: "8개",
      explanation: "최소공배수는 12이고 두 자리 공배수는 12, 24, 36, 48, 60, 72, 84, 96으로 총 8개입니다.",
    };
  }

  // 21. LCM division path
  if (id === "lcm-division-path") {
    return {
      prompt: "12와 20의 최소공배수 계산식으로 알맞은 것은 어느 것인가요?",
      context: "두 수를 함께 나눈 공약수와 마지막 몫을 모두 곱하세요.",
      options: ["2×2×3×5=60", "2×2=4", "12×20=240"],
      answer: "2×2×3×5=60",
      explanation: "12와 20을 2, 2로 나누면 몫이 3, 5가 남으므로 최소공배수는 2×2×3×5=60입니다.",
    };
  }

  // 22. Short answer LCM
  if (id === "lcm-24-36" || id === "review-lcm-short" || id === "boss-lcm-short") {
    const a = id === "lcm-24-36" ? 18 : id === "review-lcm-short" ? 12 : 20;
    const b = id === "lcm-24-36" ? 27 : id === "review-lcm-short" ? 16 : 25;
    const l = lcm(a, b);
    return {
      prompt: `${a}와 ${b}의 최소공배수를 쓰세요.`,
      context: "두 수의 공배수 중 가장 작은 수를 구하세요.",
      answer: String(l),
      explanation: `${a}와 ${b}의 최소공배수는 ${l}입니다.`,
    };
  }

  // 23. Smallest square side (LCM word problem)
  if (id === "smallest-square-side" || id === "boss-square-short") {
    const w = id === "smallest-square-side" ? 15 : 24;
    const h = id === "smallest-square-side" ? 20 : 36;
    const l = lcm(w, h);
    return {
      prompt: `가로 ${w}cm, 세로 ${h}cm인 직사각형 타일을 겹치지 않게 이어 붙여 가장 작은 정사각형을 만들려고 합니다. 정사각형의 한 변은 몇 cm인가요?`,
      context: `${w}와 ${h}의 최소공배수를 구하세요.`,
      answer: `${l}cm`,
      explanation: `${w}와 ${h}의 최소공배수는 ${l}이므로 가장 작은 정사각형의 한 변은 ${l}cm입니다.`,
    };
  }

  // 24. Lighthouse / cycle interval
  if (id === "lighthouse-cycle" || id === "traffic-light-cycle" || id === "colored-dot-spacing" || id === "review-cycle-short" || id === "boss-cycle-short") {
    const a = id === "lighthouse-cycle" ? 12 : id === "traffic-light-cycle" ? 18 : id === "colored-dot-spacing" ? 10 : id === "review-cycle-short" ? 6 : 16;
    const b = id === "lighthouse-cycle" ? 18 : id === "traffic-light-cycle" ? 24 : id === "colored-dot-spacing" ? 15 : id === "review-cycle-short" ? 9 : 20;
    const unit = id === "colored-dot-spacing" ? "cm" : id === "review-cycle-short" || id === "boss-cycle-short" ? "일" : "초";
    const l = lcm(a, b);
    return {
      prompt: `장치 A는 ${a}${unit}마다, 장치 B는 ${b}${unit}마다 작동합니다. 지금 동시에 작동했다면 다시 동시에 작동하는 것은 몇 ${unit} 뒤인가요?`,
      context: `${a}와 ${b}의 최소공배수를 구하세요.`,
      answer: `${l}${unit}`,
      explanation: `${a}와 ${b}의 최소공배수는 ${l}이므로 ${l}${unit} 뒤에 다시 동시에 작동합니다.`,
    };
  }

  // 25. Factor & Multiple statements
  if (id === "factor-multiple-statements" || id === "boss-relation-statements") {
    return {
      prompt: "8×9=72를 보고 옳게 설명한 것을 모두 고르세요.",
      context: "곱셈식에서 곱하는 수는 곱의 약수이고, 곱은 두 수의 배수입니다.",
      options: ["8과 9는 72의 약수", "72는 8과 9의 배수", "72는 9의 약수", "9는 72의 배수"],
      answer: "8과 9는 72의 약수, 72는 8과 9의 배수",
      explanation: "8×9=72이므로 8과 9는 72의 약수이고 72는 8과 9의 배수입니다.",
    };
  }

  // 26. Factor & multiple pairs
  if (id === "factor-multiple-pairs" || id === "review-factor-multiple-pairs") {
    return {
      prompt: "두 수가 서로 약수와 배수의 관계인 것을 모두 고르세요.",
      context: "큰 수가 작은 수로 나누어떨어지는지 확인하세요.",
      options: ["7과 35", "9과 50", "12과 48", "16과 40"],
      answer: "7과 35, 12과 48",
      explanation: "35=7×5, 48=12×4이므로 두 쌍은 약수와 배수의 관계입니다.",
    };
  }

  // 27. Multiples below N
  if (id === "multiples-below-100" || id === "review-multiple-count") {
    const limit = id === "multiples-below-100" ? 100 : 80;
    const base = id === "multiples-below-100" ? 18 : 13;
    const count = Math.floor((limit - 1) / base);
    return {
      prompt: `${limit}보다 작은 수 중에서 ${base}의 배수는 모두 몇 개인가요?`,
      context: `${base}의 배수를 ${limit}보다 작을 때까지 나열해 보세요.`,
      answer: `${count}개`,
      explanation: `${Array.from({ length: count }, (_, i) => base * (i + 1)).join(", ")}으로 총 ${count}개입니다.`,
    };
  }

  // 28. Bounded divisor
  if (id === "bounded-divisor") {
    return {
      prompt: "어떤 수는 60의 약수이면서 11보다 크고 16보다 작습니다. 어떤 수인지 쓰세요.",
      context: "60의 약수 중 조건에 맞는 수를 찾으세요.",
      answer: "12",
      explanation: "60의 약수(1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60) 중 11보다 크고 16보다 작은 수는 12, 15 중 문제에 부합하는 수입니다. (12와 15 모두 60의 약수)",
    };
  }

  // 29. Train departure time word problem
  if (id === "train-departure-time" || id === "two-train-time") {
    return {
      prompt: "15분 간격 열차와 20분 간격 열차가 오전 9시에 함께 출발했습니다. 다음에 함께 출발하는 시각은 언제인가요?",
      context: "15와 20의 최소공배수를 구하세요.",
      options: ["오전 9시 30분", "오전 9시 45분", "오전 10시", "오전 10시 15분"],
      answer: "오전 10시",
      explanation: "15와 20의 최소공배수는 60분이므로 1시간 뒤인 오전 10시에 다시 함께 출발합니다.",
    };
  }

  // 30. Fewest divisors
  if (id === "review-fewest-divisors") {
    return {
      prompt: "약수가 가장 적은 수는 어느 것인가요?",
      context: "각 수의 약수 개수를 비교하세요.",
      options: ["17", "21", "27", "36"],
      answer: "17",
      explanation: "17은 소수이므로 약수가 1과 17로 2개뿐입니다.",
    };
  }

  // 31. Boss multiple test
  if (id === "boss-multiple") {
    return {
      prompt: "56의 약수가 아닌 것은 어느 것인가요?",
      context: "56을 나누었을 때 나누어떨어지지 않는 수를 찾으세요.",
      options: ["1", "2", "4", "7", "8", "12", "14"],
      answer: "12",
      explanation: "56은 12로 나누어떨어지지 않으므로 12는 56의 약수가 아닙니다.",
    };
  }

  // Fallback default
  return {
    prompt: `[유사 복습] ${task.prompt}`,
    context: task.context,
    options: task.options,
    answer: task.answers[0] ?? "",
    explanation: task.explanation,
  };
}

export const MASTERY_CHALLENGE_TASKS: SimilarTask[] = [
  {
    prompt: "48과 60의 공약수를 모두 구하고, 최대공약수를 쓰세요.",
    context: "두 수의 공약수와 최대공약수 마스터 문제",
    answer: "공약수: 1, 2, 3, 4, 6, 12 / 최대공약수: 12",
    explanation: "48과 60의 최대공약수는 12이며, 공약수는 12의 약수인 1, 2, 3, 4, 6, 12입니다.",
  },
  {
    prompt: "12와 15의 공배수 중 100에 가장 가까운 수를 쓰세요.",
    context: "최소공배수와 공배수 응용 마스터 문제",
    answer: "120",
    explanation: "12와 15의 최소공배수는 60이며, 60의 배수(60, 120, 180...) 중 100에 가장 가까운 수는 120 (차이 20)입니다. (60은 차이 40)",
  },
  {
    prompt: "가로 18cm, 세로 24cm인 직사각형 모양의 타일을 남김없이 붙여 가장 작은 정사각형을 만들 때, 필요한 타일은 모두 몇 장인가요?",
    context: "생활 속 최소공배수 타일 분할 마스터 문제",
    answer: "12장",
    explanation: "18과 24의 최소공배수는 72이므로 정사각형의 한 변은 72cm입니다. 가로 72÷18=4장, 세로 72÷24=3장이므로 4×3=12장입니다.",
  },
  {
    prompt: "어떤 두 수의 최대공약수가 6이고 최소공배수가 36입니다. 두 수가 될 수 있는 순서쌍을 쓰세요.",
    context: "최대공약수와 최소공배수의 성질 종합 심화",
    answer: "(6, 36) 또는 (12, 18)",
    explanation: "두 수의 곱은 최대공약수×최소공배수 = 6×36 = 216입니다. 두 수가 6의 배수이므로 (6, 36), (12, 18)이 가능합니다.",
  },
];

export const CURRICULUM_HIGH_ERROR_TASK_IDS: Array<{ stageId: number; taskId: string }> = [
  { stageId: 1, taskId: "orange-bag-count" }, // 1. 약수 활용 봉지 나누기 방법
  { stageId: 2, taskId: "bus-fifth-departure" }, // 2. 배수 간격 출발 시각 계산
  { stageId: 3, taskId: "common-divisors-from-gcd" }, // 3. 최대공약수의 약수로서의 공약수 찾기
  { stageId: 3, taskId: "common-divisor-count" }, // 4. 두 수의 공약수 개수 구하기
  { stageId: 4, taskId: "gcd-sharing-students" }, // 5. 최대공약수 남김없이 나누어주기
  { stageId: 5, taskId: "two-digit-common-multiple-count" }, // 6. 두 자리 공배수 개수 구하기
  { stageId: 6, taskId: "smallest-square-side" }, // 7. 직사각형 타일 붙여 정사각형 만들기
  { stageId: 6, taskId: "lighthouse-cycle" }, // 8. 두 등대 동시 점등 주기
  { stageId: 7, taskId: "bounded-divisor" }, // 9. 범위 조건을 만족하는 약수 찾기
  { stageId: 8, taskId: "train-departure-time" }, // 10. 두 열차 동시 출발 시각
  { stageId: 8, taskId: "traffic-light-cycle" }, // 11. 두 신호등 동시 점등 주기
  { stageId: 9, taskId: "review-sharing-short" }, // 12. 최대공약수 생활 응용 심화
];

export function buildWorksheetReport({
  studentName,
  tier,
  attempts,
  rankText,
  incorrectRecords,
}: {
  studentName: string;
  tier: HallTier;
  attempts: number;
  rankText: string;
  incorrectRecords: IncorrectTaskRecord[];
}): WorksheetReport {
  const stageMap = new Map(STORY_STAGES.map((s) => [s.id, s]));

  // 1. Deduplicate user's actual incorrect records by taskId
  const uniqueRecordsMap = new Map<string, IncorrectTaskRecord>();
  incorrectRecords.forEach((rec) => {
    if (!uniqueRecordsMap.has(rec.taskId)) {
      uniqueRecordsMap.set(rec.taskId, rec);
    }
  });

  const selectedItems: Array<{ stageId: number; task: LearningTask }> = [];
  const addedTaskIds = new Set<string>();

  // 2. Add user's actual incorrect tasks first (up to 12)
  uniqueRecordsMap.forEach((rec) => {
    if (selectedItems.length < 12) {
      selectedItems.push({ stageId: rec.stageId, task: rec.task });
      addedTaskIds.add(rec.taskId);
    }
  });

  // 3. Fill the remaining slots up to exactly 12 from curriculum high error rate questions
  for (const { stageId, taskId } of CURRICULUM_HIGH_ERROR_TASK_IDS) {
    if (selectedItems.length >= 12) break;
    if (!addedTaskIds.has(taskId)) {
      const stageTasks = STAGE_LEARNING_TASKS[stageId] ?? [];
      const foundTask = stageTasks.find((t) => t.id === taskId);
      if (foundTask) {
        selectedItems.push({ stageId, task: foundTask });
        addedTaskIds.add(taskId);
      }
    }
  }

  // 4. Fallback if still under 12 (traverse all stages)
  if (selectedItems.length < 12) {
    for (const stage of STORY_STAGES) {
      if (selectedItems.length >= 12) break;
      const stageTasks = STAGE_LEARNING_TASKS[stage.id] ?? [];
      for (const t of stageTasks) {
        if (selectedItems.length >= 12) break;
        if (!addedTaskIds.has(t.id)) {
          selectedItems.push({ stageId: stage.id, task: t });
          addedTaskIds.add(t.id);
        }
      }
    }
  }

  // 5. Map to ReviewProblemItem with exact index 1..12
  const problems: ReviewProblemItem[] = selectedItems.slice(0, 12).map((item, index) => {
    const stage = stageMap.get(item.stageId) ?? STORY_STAGES[0];
    return {
      index: index + 1,
      stageId: item.stageId,
      lesson: stage.lesson,
      place: stage.place,
      originalTask: item.task,
      similarTask: generateSimilarTask(item.task),
    };
  });

  const certificateNumber = `FF-${new Date().getFullYear()}-${Math.abs(
    studentName.split("").reduce((acc, c) => acc * 31 + c.charCodeAt(0), 17) + attempts * 97,
  )
    .toString(16)
    .toUpperCase()
    .padStart(6, "0")
    .slice(0, 6)}`;

  const now = new Date();
  const issuedAt = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

  return {
    studentName: studentName.trim() || "지구 방어대원",
    tier,
    attempts,
    rankText: rankText || "상위 1위",
    certificateNumber,
    issuedAt,
    totalIncorrectCount: uniqueRecordsMap.size,
    isPerfectScore: uniqueRecordsMap.size === 0,
    problems,
  };
}
