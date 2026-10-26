import React from 'react';
import {
  Utensils,
  ShoppingCart,
  Home,
  Car,
  Lightbulb,
  Heart,
  Smile,
  GraduationCap,
  Briefcase,
  Gift,
  Plane,
  Film,
  Shirt,
  Smartphone,
  Coffee,
  PiggyBank,
  Wallet,
  DollarSign,
  TrendingUp,
  Package,
} from 'lucide-react';

export interface CategoryIcon {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}

// Mapping danh mục tiếng Việt sang icon + màu sắc thông minh
export const CATEGORY_ICONS: Record<string, CategoryIcon> = {
  // Ăn uống & Thực phẩm
  'Ăn uống': {
    icon: Utensils,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Ăn uống',
  },
  'Đồ ăn': {
    icon: Utensils,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Đồ ăn',
  },
  'Cà phê': {
    icon: Coffee,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    label: 'Cà phê',
  },

  // Mua sắm
  'Mua sắm': {
    icon: ShoppingCart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    label: 'Mua sắm',
  },
  'Shopping': {
    icon: ShoppingCart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    label: 'Shopping',
  },
  'Quần áo': {
    icon: Shirt,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Quần áo',
  },

  // Nhà cửa & Sinh hoạt
  'Nhà cửa': {
    icon: Home,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Nhà cửa',
  },
  'Tiền nhà': {
    icon: Home,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Tiền nhà',
  },
  'Điện nước': {
    icon: Lightbulb,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Điện nước',
  },
  'Hóa đơn': {
    icon: Package,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    label: 'Hóa đơn',
  },

  // Di chuyển
  'Di chuyển': {
    icon: Car,
    color: 'text-sky-600',
    bgColor: 'bg-sky-100',
    label: 'Di chuyển',
  },
  'Xe': {
    icon: Car,
    color: 'text-sky-600',
    bgColor: 'bg-sky-100',
    label: 'Xe',
  },
  'Xăng xe': {
    icon: Car,
    color: 'text-sky-700',
    bgColor: 'bg-sky-100',
    label: 'Xăng xe',
  },

  // Sức khỏe
  'Sức khỏe': {
    icon: Heart,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Sức khỏe',
  },
  'Y tế': {
    icon: Heart,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Y tế',
  },

  // Giải trí & Du lịch
  'Giải trí': {
    icon: Smile,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Giải trí',
  },
  'Phim ảnh': {
    icon: Film,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    label: 'Phim ảnh',
  },
  'Du lịch': {
    icon: Plane,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    label: 'Du lịch',
  },

  // Học tập
  'Học tập': {
    icon: GraduationCap,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Học tập',
  },

  // Công việc
  'Công việc': {
    icon: Briefcase,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    label: 'Công việc',
  },

  // Quà tặng
  'Quà tặng': {
    icon: Gift,
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
    label: 'Quà tặng',
  },

  // Tiết kiệm
  'Tiết kiệm': {
    icon: PiggyBank,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    label: 'Tiết kiệm',
  },

  // Công nghệ
  'Công nghệ': {
    icon: Smartphone,
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    label: 'Công nghệ',
  },

  // Thu nhập
  'Lương': {
    icon: DollarSign,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Lương',
  },
  'Lương Heo': {
    icon: DollarSign,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Lương Heo',
  },
  'Lương Mèo': {
    icon: DollarSign,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Lương Mèo',
  },
  'Thu nhập': {
    icon: TrendingUp,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    label: 'Thu nhập',
  },
  'Thưởng': {
    icon: TrendingUp,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    label: 'Thưởng',
  },
};

// Default fallback icon cho danh mục không match
export const DEFAULT_CATEGORY_ICON: CategoryIcon = {
  icon: Wallet,
  color: 'text-slate-600',
  bgColor: 'bg-slate-100',
  label: 'Khác',
};

/**
 * Lấy icon tương ứng với tên danh mục (case-insensitive, fuzzy matching)
 */
export function getCategoryIcon(categoryName: string): CategoryIcon {
  // Exact match
  if (CATEGORY_ICONS[categoryName]) {
    return CATEGORY_ICONS[categoryName];
  }

  // Case-insensitive search
  const lowerCategory = categoryName.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_ICONS)) {
    if (key.toLowerCase() === lowerCategory) {
      return value;
    }
  }

  // Fuzzy partial match (ví dụ: "Ăn uống gà rán" khớp với "Ăn uống")
  for (const [key, value] of Object.entries(CATEGORY_ICONS)) {
    if (
      lowerCategory.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lowerCategory)
    ) {
      return value;
    }
  }

  return DEFAULT_CATEGORY_ICON;
}

/**
 * Component Badge hiển thị icon + tên danh mục
 */
interface CategoryBadgeProps {
  category: string;
  onClick?: () => void;
  compact?: boolean;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  onClick,
  compact = false,
}) => {
  const iconData = getCategoryIcon(category);
  const Icon = iconData.icon;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${iconData.bgColor} ${iconData.color} hover:opacity-80 transition-opacity text-xs font-medium`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{category}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${iconData.bgColor} ${iconData.color} hover:opacity-80 transition-opacity text-sm font-semibold`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{category}</span>
    </button>
  );
};
