/** Text color for the recommendation scale: 1 is red and 5 is green. */
export function getRecommendationColorClass(recommendation: number | null): string {
  switch (recommendation) {
    case 1: return 'text-red-600 dark:text-red-400';
    case 2: return 'text-orange-600 dark:text-orange-400';
    case 3: return 'text-yellow-600 dark:text-yellow-400';
    case 4: return 'text-lime-600 dark:text-lime-400';
    case 5: return 'text-green-600 dark:text-green-400';
    default: return '';
  }
}
