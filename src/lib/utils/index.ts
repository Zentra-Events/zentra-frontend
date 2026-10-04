import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(
    amount: number,
    currency: string = "INR",
    locale: string = "en-IN",
): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
    }).format(amount);
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trimEnd() + "...";
}

export function pluralize(count: number, singular: string, plural?: string): string {
    return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function calculatePercentageAmount(amount: number, percentage: number): number {
    return (amount * percentage) / 100;
}

/**
 * Convert a numeric amount to words in Indian numbering system (Rupees)
 */
export function numberToWords(amount: number): string {
    if (amount === 0) return "Zero Rupees Only";

    const whole = Math.floor(Math.abs(amount));
    const paise = Math.round((Math.abs(amount) - whole) * 100);

    if (whole === 0 && paise > 0) {
        return `Paise ${convertBelow1000(paise)} Only`;
    }

    const rupees = convertIndianNumber(whole);
    let result = `Rupees ${rupees}`;

    if (paise > 0) {
        result += ` and Paise ${convertBelow1000(paise)}`;
    }

    result += " Only";
    return result.charAt(0).toUpperCase() + result.slice(1);
}

export function convertIndianNumber(n: number): string {
    if (n === 0) return "";

    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = [
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];
    const tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ];

    const convertBelow1000 = (num: number): string => {
        let result = "";
        if (num >= 100) {
            result += units[Math.floor(num / 100)] + " Hundred ";
            num %= 100;
        }
        if (num >= 20) {
            result += tens[Math.floor(num / 10)] + " ";
            num %= 10;
        } else if (num >= 10) {
            result += teens[num - 10] + " ";
            num = 0;
        }
        if (num > 0) {
            result += units[num] + " ";
        }
        return result.trim();
    };

    let result = "";
    // Indian numbering: lakh (100,000) and crore (10,000,000)
    const crore = Math.floor(n / 10000000);
    if (crore > 0) {
        result += convertBelow1000(crore) + " Crore ";
        n %= 10000000;
    }
    const lakh = Math.floor(n / 100000);
    if (lakh > 0) {
        result += convertBelow1000(lakh) + " Lakh ";
        n %= 100000;
    }
    const thousand = Math.floor(n / 1000);
    if (thousand > 0) {
        result += convertBelow1000(thousand) + " Thousand ";
        n %= 1000;
    }
    if (n > 0) {
        result += convertBelow1000(n);
    }

    return result.trim();
}

export function convertBelow1000(num: number): string {
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = [
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];
    const tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ];
    let result = "";
    if (num >= 100) {
        result += units[Math.floor(num / 100)] + " Hundred ";
        num %= 100;
    }
    if (num >= 20) {
        result += tens[Math.floor(num / 10)] + " ";
        num %= 10;
    } else if (num >= 10) {
        result += teens[num - 10] + " ";
        num = 0;
    }
    if (num > 0) {
        result += units[num] + " ";
    }
    return result.trim();
}

/* ------------------------------------------------------------------ */
/*  Roman numeral helper                                              */
/* ------------------------------------------------------------------ */

export function toRomanLower(index: number): string {
    const numerals: [number, string][] = [
        [1000, "m"],
        [900, "cm"],
        [500, "d"],
        [400, "cd"],
        [100, "c"],
        [90, "xc"],
        [50, "l"],
        [40, "xl"],
        [10, "x"],
        [9, "ix"],
        [5, "v"],
        [4, "iv"],
        [1, "i"],
    ];
    let n = index;
    let result = "";
    for (const [value, numeral] of numerals) {
        while (n >= value) {
            result += numeral;
            n -= value;
        }
    }
    return result;
}

/* ------------------------------------------------------------------ */
/*  Currency formatter                                                 */
/* ------------------------------------------------------------------ */

export function formatExportCurrency(value: number): string {
    return value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/* ------------------------------------------------------------------ */
/*  Grouping utilities (Category / Sub Category)                       */
/* ------------------------------------------------------------------ */

export {
    groupByCategory,
    groupItemsByCategory,
    flattenCategoryGroups,
    flattenItemsByCategory,
} from "./grouping";

export type {
    Groupable,
    CategoryGroup,
    SubCategoryGroup,
    GroupingOptions,
} from "./grouping";
