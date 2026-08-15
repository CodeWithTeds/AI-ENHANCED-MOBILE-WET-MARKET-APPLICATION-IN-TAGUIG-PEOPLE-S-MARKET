import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ChefHat,
    Eye,
    Flame,
    MessageSquare,
    SearchX,
    Sparkles,
    Star,
    Trash2,
    User,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { dashboard } from '@/routes';

type RecipeIngredient = {
    name: string;
    quantity: string;
    available_in_market?: boolean;
};
type RecipeReview = {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string;
    user: string;
};
type RecipePayload = {
    recipe_name?: string;
    description?: string;
    servings?: string;
    prep_time?: string;
    cook_time?: string;
    ingredients?: RecipeIngredient[];
    steps?: string[];
    tips?: string;
    found?: boolean;
    message?: string;
};

type RecipeRecommendation = {
    id: number;
    query: string;
    recipe_name: string | null;
    status: string;
    status_label: string;
    error_message: string | null;
    ingredient_count: number;
    matching_count: number;
    matching_products: {
        ingredient: string;
        product_id: number;
        product_name: string;
        price: string;
        unit: string;
        category: string;
    }[];
    payload: RecipePayload;
    review_count: number;
    review_average: number;
    reviews: RecipeReview[];
    user: { id: number; name: string; email: string } | null;
    created_at: string;
};

type FilterOption = { value: string; label: string };

type Props = {
    recommendations: {
        data: RecipeRecommendation[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        found: number;
        not_found: number;
        error: number;
        unique_recipes: number;
        recipe_reviews: number;
    };
    filters: Record<string, string | undefined>;
    statuses: FilterOption[];
    top_recipes: { name: string; count: number }[];
};

export default function RecommendationsIndex({
    recommendations,
    stats,
    filters,
    statuses,
    top_recipes,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selected, setSelected] = useState<RecipeRecommendation | null>(null);

    function applyFilter(key: string, value: string | undefined) {
        router.get(
            '/admin/dashboard/recommendations',
            {
                ...filters,
                [key]: value || undefined,
                page: undefined,
            },
            { preserveState: true, preserveScroll: true },
        );
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        applyFilter('search', search || undefined);
    }

    function clearFilters() {
        router.get(
            '/admin/dashboard/recommendations',
            {},
            { preserveState: true },
        );
        setSearch('');
    }

    function handleDelete(rec: RecipeRecommendation) {
        const name = rec.recipe_name ?? rec.query;

        if (
            confirm(
                `Delete the recommendation for "${name}"? This cannot be undone.`,
            )
        ) {
            router.delete(`/admin/dashboard/recommendations/${rec.id}`, {
                preserveScroll: true,
            });
        }
    }

    function handleClearAll() {
        if (
            confirm(
                `Clear ALL ${recommendations.total} AI recommendation log(s)? This cannot be undone.`,
            )
        ) {
            router.delete('/admin/dashboard/recommendations', {
                preserveScroll: true,
            });
        }
    }

    const hasActiveFilters = filters.search || filters.status;

    return (
        <>
            <Head title="AI Recommendations" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">
                            AI Recommendations
                        </h1>
                        <p className="text-xs text-gray-500">
                            Monitor and manage AI-generated recipe
                            recommendations
                        </p>
                    </div>
                    <button
                        onClick={handleClearAll}
                        disabled={recommendations.total === 0}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear All
                    </button>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    <StatCard
                        icon={Sparkles}
                        color="text-gray-600"
                        bg="bg-gray-100"
                        label="Total Requests"
                        value={stats.total}
                    />
                    <StatCard
                        icon={CheckCircle2}
                        color="text-[#488562]"
                        bg="bg-[#488562]/10"
                        label="Found"
                        value={stats.found}
                    />
                    <StatCard
                        icon={SearchX}
                        color="text-[#ee600e]"
                        bg="bg-[#ee600e]/10"
                        label="Not Found"
                        value={stats.not_found}
                    />
                    <StatCard
                        icon={AlertTriangle}
                        color="text-red-500"
                        bg="bg-red-50"
                        label="Errors"
                        value={stats.error}
                    />
                    <StatCard
                        icon={ChefHat}
                        color="text-[#0867ff]"
                        bg="bg-[#0867ff]/10"
                        label="Unique Recipes"
                        value={stats.unique_recipes}
                    />
                    <StatCard
                        icon={MessageSquare}
                        color="text-purple-700"
                        bg="bg-purple-50"
                        label="Recipe Reviews"
                        value={stats.recipe_reviews}
                    />
                </div>

                {/* Top recommended dishes */}
                {top_recipes.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-2.5 flex items-center gap-1.5">
                            <Flame className="h-4 w-4 text-[#ee600e]" />
                            <span className="text-xs font-bold text-gray-700">
                                Top Recommended Dishes
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {top_recipes.map((rec) => (
                                <div
                                    key={rec.name}
                                    className="flex items-center gap-2 rounded-lg bg-[#ee600e]/5 px-3 py-1.5"
                                >
                                    <span className="text-xs font-semibold text-gray-800">
                                        {rec.name}
                                    </span>
                                    <span className="rounded-md bg-[#ee600e]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#ee600e]">
                                        {rec.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search query or dish..."
                            className="h-8 w-52 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                    </form>

                    <ChipSelect
                        label="Status"
                        value={filters.status}
                        options={statuses}
                        onChange={(v) => applyFilter('status', v)}
                    />

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100"
                        >
                            <X className="h-3 w-3" />
                            Clear all
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        #
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Query
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Recipe
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Matches
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Reviews
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Source
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Requested
                                    </th>
                                    <th className="px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recommendations.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="px-4 py-16 text-center text-sm text-gray-400"
                                        >
                                            <Sparkles className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            No AI recommendations found.
                                        </td>
                                    </tr>
                                ) : (
                                    recommendations.data.map((rec, idx) => (
                                        <tr
                                            key={rec.id}
                                            className="group transition hover:bg-[#488562]/[0.02]"
                                        >
                                            <td className="px-4 py-2.5 text-xs text-gray-400">
                                                {(recommendations.current_page -
                                                    1) *
                                                    recommendations.per_page +
                                                    idx +
                                                    1}
                                            </td>
                                            <td className="max-w-[180px] px-4 py-2.5">
                                                <span className="text-xs font-medium text-gray-800">
                                                    {rec.query}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {rec.recipe_name ? (
                                                    <span className="text-xs font-bold text-gray-900">
                                                        {rec.recipe_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300 italic">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <StatusBadge
                                                    status={rec.status}
                                                    label={rec.status_label}
                                                />
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">
                                                {rec.matching_count}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Star
                                                        className={`h-3.5 w-3.5 ${rec.review_count > 0 ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                                                    />
                                                    <span className="text-xs font-semibold text-gray-800">
                                                        {rec.review_average ||
                                                            '—'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">
                                                        ({rec.review_count})
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {rec.user ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="h-3 w-3 shrink-0 text-gray-400" />
                                                        <span className="text-xs text-gray-700">
                                                            {rec.user.name}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                                                        Guest / API
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-[11px] text-gray-400">
                                                {formatDate(rec.created_at)}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() =>
                                                            setSelected(rec)
                                                        }
                                                        className="rounded-md p-1.5 text-gray-400 transition hover:bg-[#488562]/10 hover:text-[#488562]"
                                                        title="View details"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDelete(rec)
                                                        }
                                                        className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {recommendations.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                            <span className="text-[11px] text-gray-500">
                                {(recommendations.current_page - 1) *
                                    recommendations.per_page +
                                    1}
                                &#8211;
                                {Math.min(
                                    recommendations.current_page *
                                        recommendations.per_page,
                                    recommendations.total,
                                )}{' '}
                                of {recommendations.total}
                            </span>
                            <div className="flex gap-0.5">
                                {recommendations.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() =>
                                            link.url &&
                                            router.get(
                                                link.url,
                                                {},
                                                {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                },
                                            )
                                        }
                                        className={`h-7 min-w-7 rounded-md px-2 text-[11px] font-medium transition ${
                                            link.active
                                                ? 'bg-[#488562] text-white'
                                                : link.url
                                                  ? 'text-gray-600 hover:bg-gray-100'
                                                  : 'text-gray-300'
                                        }`}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Recipe detail modal */}
            <Dialog
                open={selected !== null}
                onOpenChange={(open) => !open && setSelected(null)}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#ee600e]" />
                            {selected?.recipe_name ?? selected?.query}
                        </DialogTitle>
                        <DialogDescription>
                            {selected?.status_label} recommendation
                            {selected?.recipe_name
                                ? ` for "${selected.query}"`
                                : ''}
                        </DialogDescription>
                    </DialogHeader>
                    {selected && <RecipeDetail rec={selected} />}
                </DialogContent>
            </Dialog>
        </>
    );
}

RecommendationsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        {
            title: 'AI Recommendations',
            href: '/admin/dashboard/recommendations',
        },
    ],
};

/* ─── Sub Components ─── */

function StatCard({
    icon: Icon,
    color,
    bg,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    label: string;
    value: number;
}) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}
            >
                <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                    {label}
                </div>
                <div className="text-xl font-bold text-gray-900">{value}</div>
            </div>
        </div>
    );
}

function ChipSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value?: string;
    options: FilterOption[];
    onChange: (v: string | undefined) => void;
}) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium transition focus:ring-1 focus:ring-[#488562] focus:outline-none ${
                value
                    ? 'border-[#488562]/30 bg-[#488562]/5 text-[#488562]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
        >
            <option value="">{label}: All</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
    const config: Record<
        string,
        {
            bg: string;
            text: string;
            Icon: React.ComponentType<{ className?: string }>;
        }
    > = {
        found: {
            bg: 'bg-[#488562]/10',
            text: 'text-[#488562]',
            Icon: CheckCircle2,
        },
        not_found: {
            bg: 'bg-[#ee600e]/10',
            text: 'text-[#ee600e]',
            Icon: SearchX,
        },
        error: { bg: 'bg-red-50', text: 'text-red-500', Icon: AlertTriangle },
    };
    const c = config[status] ?? {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        Icon: Sparkles,
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}
        >
            <c.Icon className="h-3 w-3" />
            {label}
        </span>
    );
}

function RecipeDetail({ rec }: { rec: RecipeRecommendation }) {
    const payload = rec.payload;

    if (
        rec.status !== 'found' ||
        !payload ||
        Object.keys(payload).length === 0
    ) {
        return (
            <div className="space-y-4">
                <div className="rounded-xl border border-red-50 bg-red-50/50 p-4 text-xs text-red-600">
                    {rec.error_message ??
                        payload?.message ??
                        'No recipe was generated for this request.'}
                </div>
                <MetaRow label="Search query" value={rec.query} />
                <MetaRow label="Requested" value={formatDate(rec.created_at)} />
            </div>
        );
    }

    return (
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            {payload.description && (
                <p className="text-sm text-gray-600">{payload.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetaCard label="Servings" value={payload.servings ?? '—'} />
                <MetaCard label="Prep Time" value={payload.prep_time ?? '—'} />
                <MetaCard label="Cook Time" value={payload.cook_time ?? '—'} />
                <MetaCard
                    label="Ingredients"
                    value={String(payload.ingredients?.length ?? 0)}
                />
            </div>

            {/* Ingredients */}
            {payload.ingredients && payload.ingredients.length > 0 && (
                <section>
                    <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-400 uppercase">
                        Ingredients
                    </h3>
                    <ul className="space-y-1.5">
                        {payload.ingredients.map((ing, i) => (
                            <li
                                key={i}
                                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs"
                            >
                                <span className="font-medium text-gray-800">
                                    <span className="text-gray-400">
                                        {ing.quantity}
                                    </span>{' '}
                                    {ing.name}
                                </span>
                                <span
                                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                        ing.available_in_market
                                            ? 'bg-[#488562]/10 text-[#488562]'
                                            : 'bg-red-50 text-red-500'
                                    }`}
                                >
                                    {ing.available_in_market
                                        ? 'In market'
                                        : 'Not in market'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Matching products */}
            {rec.matching_products.length > 0 && (
                <section>
                    <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-400 uppercase">
                        Matching Market Products
                    </h3>
                    <div className="space-y-1.5">
                        {rec.matching_products.map((match, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-1.5 text-xs"
                            >
                                <div>
                                    <div className="font-semibold text-gray-800">
                                        {match.product_name}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        for &quot;{match.ingredient}&quot; ·{' '}
                                        {match.category}
                                    </div>
                                </div>
                                <span className="font-bold text-gray-900">
                                    &#8369;
                                    {Number(match.price).toLocaleString(
                                        undefined,
                                        { maximumFractionDigits: 2 },
                                    )}
                                    /{match.unit}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Steps */}
            {payload.steps && payload.steps.length > 0 && (
                <section>
                    <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-400 uppercase">
                        Steps
                    </h3>
                    <ol className="space-y-2">
                        {payload.steps.map((step, i) => (
                            <li
                                key={i}
                                className="flex gap-2 text-xs text-gray-700"
                            >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#488562]/10 text-[10px] font-bold text-[#488562]">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {payload.tips && (
                <section className="rounded-xl border border-[#ee600e]/20 bg-[#ee600e]/5 p-3">
                    <div className="mb-1 text-[10px] font-bold tracking-wide text-[#ee600e] uppercase">
                        Tip
                    </div>
                    <p className="text-xs text-gray-700">{payload.tips}</p>
                </section>
            )}

            {/* Related reviews */}
            <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-gray-400 uppercase">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Reviews ({rec.review_count})
                </h3>
                {rec.reviews.length === 0 ? (
                    <p className="text-xs text-gray-300 italic">
                        No reviews for this recipe yet.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {rec.reviews.map((review) => (
                            <div
                                key={review.id}
                                className="rounded-lg bg-gray-50 p-3"
                            >
                                <div className="mb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-3 w-3 text-gray-400" />
                                        <span className="text-[11px] font-semibold text-gray-700">
                                            {review.user}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                className={`h-3 w-3 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {review.comment && (
                                    <p className="text-xs text-gray-600">
                                        {review.comment}
                                    </p>
                                )}
                                <div className="mt-1 text-[10px] text-gray-400">
                                    {formatDate(review.created_at)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function MetaCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-center">
            <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                {label}
            </div>
            <div className="mt-0.5 text-sm font-bold text-gray-900">
                {value}
            </div>
        </div>
    );
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{label}</span>
            <span className="font-medium text-gray-800">{value}</span>
        </div>
    );
}

function formatDate(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
