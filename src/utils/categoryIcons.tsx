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

/**
 * Custom Piggy Icon siêu đáng yêu cho Heo
 */
export const PigIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Left Ear */}
    <path
      d="M4.5 9C3.5 5.5 5 2.8 7.5 3.5C9.5 4.2 9 7.2 8 9"
      fill="#F472B6"
      stroke="#DB2777"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 7.5C5 6 5.8 4.6 6.8 4.8"
      stroke="#FCE7F3"
      strokeWidth="1"
      strokeLinecap="round"
    />

    {/* Right Ear */}
    <path
      d="M19.5 9C20.5 5.5 19 2.8 16.5 3.5C14.5 4.2 15 7.2 16 9"
      fill="#F472B6"
      stroke="#DB2777"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M18.5 7.5C19 6 18.2 4.6 17.2 4.8"
      stroke="#FCE7F3"
      strokeWidth="1"
      strokeLinecap="round"
    />

    {/* Head Face Base */}
    <ellipse
      cx="12"
      cy="13.5"
      rx="8.5"
      ry="7.5"
      fill="#FCE7F3"
      stroke="#F43F5E"
      strokeWidth="1.2"
    />

    {/* Eyes */}
    <circle cx="8.5" cy="12" r="1.3" fill="#1E293B" />
    <circle cx="9" cy="11.5" r="0.45" fill="#FFFFFF" />
    <circle cx="15.5" cy="12" r="1.3" fill="#1E293B" />
    <circle cx="16" cy="11.5" r="0.45" fill="#FFFFFF" />

    {/* Cheeks */}
    <ellipse cx="6" cy="14.2" rx="1.3" ry="0.8" fill="#F472B6" opacity="0.6" />
    <ellipse cx="18" cy="14.2" rx="1.3" ry="0.8" fill="#F472B6" opacity="0.6" />

    {/* Pig Snout */}
    <ellipse
      cx="12"
      cy="15"
      rx="3.8"
      ry="2.6"
      fill="#FB7185"
      stroke="#E11D48"
      strokeWidth="1.1"
    />
    {/* Nostrils */}
    <ellipse cx="10.8" cy="15" rx="0.65" ry="1.1" fill="#881337" />
    <ellipse cx="13.2" cy="15" rx="0.65" ry="1.1" fill="#881337" />
  </svg>
);

/**
 * Custom Siamese Cat Icon (Mèo Xiêm) đặc trưng với mặt nạ nâu sô-cô-la, tai đen và đôi mắt xanh sapphire biếc
 */
export const SiameseCatIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Left Ear - Dark Seal Point */}
    <path
      d="M4.2 9.8L6.8 2.5C7.1 1.8 8.1 1.8 8.4 2.5L10.5 8.2"
      fill="#3A2318"
      stroke="#261710"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
    <path
      d="M5.8 7.8L7.2 4L8.8 7.2"
      fill="#56382D"
    />

    {/* Right Ear - Dark Seal Point */}
    <path
      d="M19.8 9.8L17.2 2.5C16.9 1.8 15.9 1.8 15.6 2.5L13.5 8.2"
      fill="#3A2318"
      stroke="#261710"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
    <path
      d="M18.2 7.8L16.8 4L15.2 7.2"
      fill="#56382D"
    />

    {/* Cat Head Base - Pale Cream/Ivory */}
    <path
      d="M12 6.8C6.8 6.8 4 10 4 14.5C4 18.8 7.5 21 12 21C16.5 21 20 18.8 20 14.5C20 10 17.2 6.8 12 6.8Z"
      fill="#FAF4EE"
      stroke="#E5D5C5"
      strokeWidth="1"
    />

    {/* Siamese Signature Seal-Point Mask (Chocolate patch on muzzle & eyes) */}
    <path
      d="M8.2 10.2C9.8 9 14.2 9 15.8 10.2C17.2 11.5 17.6 14.5 16.2 17.2C14.8 19.4 9.2 19.4 7.8 17.2C6.4 14.5 6.8 11.5 8.2 10.2Z"
      fill="#43281C"
    />

    {/* Left Sapphire Blue Eye (Almond shaped) */}
    <ellipse cx="9.2" cy="12.8" rx="1.6" ry="1.2" fill="#0284C7" />
    <circle cx="9.2" cy="12.8" r="0.8" fill="#032030" />
    <circle cx="9.5" cy="12.5" r="0.35" fill="#FFFFFF" />

    {/* Right Sapphire Blue Eye (Almond shaped) */}
    <ellipse cx="14.8" cy="12.8" rx="1.6" ry="1.2" fill="#0284C7" />
    <circle cx="14.8" cy="12.8" r="0.8" fill="#032030" />
    <circle cx="15.1" cy="12.5" r="0.35" fill="#FFFFFF" />

    {/* Dark Nose */}
    <path
      d="M11.3 15.4H12.7L12 16.2Z"
      fill="#1F110A"
    />

    {/* Muzzle split / chin */}
    <path
      d="M12 16.2V17M12 17C11.5 17.4 10.8 17.4 10.5 17.2M12 17C12.5 17.4 13.2 17.4 13.5 17.2"
      stroke="#6E473B"
      strokeWidth="0.6"
      strokeLinecap="round"
    />

    {/* Whiskers */}
    <line x1="3.5" y1="15.2" x2="6.8" y2="15.6" stroke="#D7CCC8" strokeWidth="0.75" strokeLinecap="round" />
    <line x1="3" y1="16.8" x2="6.6" y2="16.4" stroke="#D7CCC8" strokeWidth="0.75" strokeLinecap="round" />
    <line x1="20.5" y1="15.2" x2="17.2" y2="15.6" stroke="#D7CCC8" strokeWidth="0.75" strokeLinecap="round" />
    <line x1="21" y1="16.8" x2="17.4" y2="16.4" stroke="#D7CCC8" strokeWidth="0.75" strokeLinecap="round" />
  </svg>
);

export interface CategoryIcon {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}

// Mapping danh mục tiếng Việt sang icon + màu sắc thông minh
export const CATEGORY_ICONS: Record<string, CategoryIcon> = {
  // Heo & Mèo giải trí & cá nhân
  'Giải trí Heo': {
    icon: PigIcon,
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    label: 'Giải trí Heo',
  },
  'Giải trí Mèo': {
    icon: SiameseCatIcon,
    color: 'text-amber-950',
    bgColor: 'bg-[#F5EBE1]',
    label: 'Giải trí Mèo',
  },
  'Lương Heo': {
    icon: PigIcon,
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    label: 'Lương Heo',
  },
  'Lương Mèo': {
    icon: SiameseCatIcon,
    color: 'text-amber-950',
    bgColor: 'bg-[#F5EBE1]',
    label: 'Lương Mèo',
  },
  'Heo': {
    icon: PigIcon,
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    label: 'Heo',
  },
  'Mèo': {
    icon: SiameseCatIcon,
    color: 'text-amber-950',
    bgColor: 'bg-[#F5EBE1]',
    label: 'Mèo',
  },

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
  if (!categoryName) return DEFAULT_CATEGORY_ICON;

  // Exact match
  if (CATEGORY_ICONS[categoryName]) {
    return CATEGORY_ICONS[categoryName];
  }

  // Case-insensitive exact search
  const lowerCategory = categoryName.toLowerCase().trim();
  for (const [key, value] of Object.entries(CATEGORY_ICONS)) {
    if (key.toLowerCase() === lowerCategory) {
      return value;
    }
  }

  // Priority detection for Heo / Mèo (tránh bị nuốt bởi "Giải trí" chung)
  if (lowerCategory.includes('heo')) {
    return CATEGORY_ICONS['Giải trí Heo'];
  }
  if (lowerCategory.includes('mèo') || lowerCategory.includes('meo')) {
    return CATEGORY_ICONS['Giải trí Mèo'];
  }

  // Fuzzy partial match (sắp xếp key dài trước để ưu tiên từ khóa chi tiết)
  const sortedKeys = Object.keys(CATEGORY_ICONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const lowerKey = key.toLowerCase();
    if (lowerCategory.includes(lowerKey) || lowerKey.includes(lowerCategory)) {
      return CATEGORY_ICONS[key];
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
