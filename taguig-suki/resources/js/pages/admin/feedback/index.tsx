import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Eye,
    MessageSquare,
    MessageSquareReply,
    Star,
    ThumbsDown,
    X,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type ReviewUser = { id: number; name: string; email: string };
type ReviewOrder = { id: number; order_number: string } | null;

type Review = {
    id: number;
    rating: number;
    comment: string | null;
    status: string;
    admin_response: string | null;
    resolved_at: string | null;
    created_at: string;
    user: ReviewUser;
    order: ReviewOrder;
    type: string;
    target_name: string | null;
};

type FilterOption = { value: string; label: string };

type Props = {
    reviews: {
        data: Review[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        pending: number;
        in_review: number;
        resolved: number;
        dismissed: number;
        low_ratings: number;
        average_rating: number;
    };
    filters: Record<string, string | undefined>;
    statuses: FilterOption[];
    types: FilterOption[];
};

export default function FeedbackIndex({ reviews, stats, filters, statuses, types }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [detailReview, setDetailReview] = useState<Review | null>(null);
    const [respondingTo, setRespondingTo] = useState<Review | null>(null);

    function applyFilter(key: string, value: string | undefined) {
        router.get('/admin/dashboard/feedback', {
            ...filters,
            [key]: value || undefined,
            page: undefined,
        }, { preserveState: true, preserveScroll: true });
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        applyFilter('search', search || undefined);
    }

    function clearFilters() {
        router.get('/admin/dashboard/feedback', {}, { preserveState: true });
        setSearch('');
    }

    const hasActiveFilters = filters.search || filters.status || filters.type || filters.rating;

    return (
        <>
            <Head title="Feedback & Complaints" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div>
                    <h1 className="text-lg font-bold text-gray-900">Feedback & Complaints</h1>
                    <p className="text-xs text-gray-500">Review customer feedback and resolve complaints or reported issues</p>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                            <MessageSquare className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total Reviews</div>
                            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <Clock className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Pending</div>
                            <div className="text-xl font-bold text-[#ee600e]">{stats.pending}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#488562]/10">
                            <CheckCircle2 className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Resolved</div>
                            <div className="text-xl font-bold text-[#488562]">{stats.resolved}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Low Ratings (&#8804;2)</div>
                            <div className="text-xl font-bold text-red-500">{stats.low_ratings}</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search review or customer..."
                            className="h-8 w-52 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                    </form>

                    <ChipSelect label="Status" value={filters.status} options={statuses} onChange={(v) => applyFilter('status', v)} />
                    <ChipSelect label="Type" value={filters.type} options={types} onChange={(v) => applyFilter('type', v)} />
                    <ChipSelect
                        label="Rating"
                        value={filters.rating}
                        options={[
                            { value: '5', label: '5 Stars' },
                            { value: '4', label: '4 Stars' },
                            { value: '3', label: '3 Stars' },
                            { value: '2', label: '2 Stars' },
                            { value: '1', label: '1 Star' },
                        ]}
                        onChange={(v) => applyFilter('rating', v)}
                    />

                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100">
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
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">#</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Target</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Rating</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Comment</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Date</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {reviews.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-16 text-center text-sm text-gray-400">
                                            <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            No reviews found.
                                        </td>
                                    </tr>
                                ) : (
                                    reviews.data.map((review, idx) => (
                                        <tr key={review.id} className="group transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{(reviews.current_page - 1) * reviews.per_page + idx + 1}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="text-xs font-medium text-gray-800">{review.user.name}</div>
                                                <div className="text-[10px] text-gray-400">{review.user.email}</div>
                                            </td>
                                            <td className="px-4 py-2.5"><TypeBadge type={review.type} /></td>
                                            <td className="px-4 py-2.5 text-xs font-medium text-gray-700">{review.target_name ?? '---'}</td>
                                            <td className="px-4 py-2.5"><StarRating rating={review.rating} /></td>
                                            <td className="max-w-[200px] px-4 py-2.5">
                                                <p className="truncate text-xs text-gray-600">{review.comment ?? '---'}</p>
                                            </td>
                                            <td className="px-4 py-2.5"><StatusBadge status={review.status} /></td>
                                            <td className="px-4 py-2.5 text-[11px] text-gray-400">{formatDate(review.created_at)}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setDetailReview(review)}
                                                        className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-medium text-gray-600 transition hover:bg-gray-50"
                                                    >
                                                        <Eye className="h-3 w-3" /> View
                                                    </button>
                                                    {(review.status === 'pending' || review.status === 'in_review') && (
                                                        <button
                                                            onClick={() => setRespondingTo(review)}
                                                            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#488562]/20 bg-[#488562]/5 px-2 text-[10px] font-medium text-[#488562] transition hover:bg-[#488562]/10"
                                                        >
                                                            <MessageSquareReply className="h-3 w-3" /> Respond
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {reviews.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                            <span className="text-[11px] text-gray-500">
                                {(reviews.current_page - 1) * reviews.per_page + 1}&#8211;{Math.min(reviews.current_page * reviews.per_page, reviews.total)} of {reviews.total}
                            </span>
                            <div className="flex gap-0.5">
                                {reviews.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                        className={`h-7 min-w-7 rounded-md px-2 text-[11px] font-medium transition ${
                                            link.active
                                                ? 'bg-[#488562] text-white'
                                                : link.url
                                                    ? 'text-gray-600 hover:bg-gray-100'
                                                    : 'text-gray-300'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {detailReview && (
                <ReviewDetailModal review={detailReview} onClose={() => setDetailReview(null)} onRespond={(r) => { setDetailReview(null); setRespondingTo(r); }} />
            )}

            {/* Respond Modal */}
            {respondingTo && (
                <RespondModal review={respondingTo} onClose={() => setRespondingTo(null)} />
            )}
        </>
    );
}

FeedbackIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Feedback & Complaints', href: '/admin/dashboard/feedback' },
    ],
};

/* ─── Sub Components ─── */

function ChipSelect({ label, value, options, onChange }: { label: string; value?: string; options: FilterOption[]; onChange: (v: string | undefined) => void }) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium transition focus:outline-none focus:ring-1 focus:ring-[#488562] ${
                value
                    ? 'border-[#488562]/30 bg-[#488562]/5 text-[#488562]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
        >
            <option value="">{label}: All</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
        pending: { bg: 'bg-[#ee600e]/10', text: 'text-[#ee600e]', label: 'Pending', Icon: Clock },
        in_review: { bg: 'bg-[#0867ff]/10', text: 'text-[#0867ff]', label: 'In Review', Icon: Eye },
        resolved: { bg: 'bg-[#488562]/10', text: 'text-[#488562]', label: 'Resolved', Icon: CheckCircle2 },
        dismissed: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Dismissed', Icon: XCircle },
    };
    const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status, Icon: Clock };

    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}>
            <c.Icon className="h-3 w-3" />
            {c.label}
        </span>
    );
}

function TypeBadge({ type }: { type: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        vendor: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Vendor' },
        product: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Product' },
        recipe: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Recipe' },
    };
    const c = config[type] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: type };

    return (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}>
            {c.label}
        </span>
    );
}

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={`h-3 w-3 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
                />
            ))}
            <span className="ml-1 text-[10px] font-bold text-gray-500">{rating}</span>
        </div>
    );
}

function ReviewDetailModal({ review, onClose, onRespond }: { review: Review; onClose: () => void; onRespond: (r: Review) => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h3 className="text-sm font-bold text-gray-900">Review Details</h3>
                    <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-4 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-medium text-gray-800">{review.user.name}</div>
                            <div className="text-[10px] text-gray-400">{review.user.email}</div>
                        </div>
                        <StatusBadge status={review.status} />
                    </div>
                    <div className="flex items-center gap-4">
                        <StarRating rating={review.rating} />
                        <TypeBadge type={review.type} />
                        {review.target_name && (
                            <span className="text-[11px] text-gray-500">Target: <span className="font-medium text-gray-700">{review.target_name}</span></span>
                        )}
                    </div>
                    {review.order && (
                        <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                            Related Order: <span className="font-semibold text-gray-700">{review.order.order_number}</span>
                        </div>
                    )}
                    <div className="rounded-lg bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Customer Comment</div>
                        <p className="mt-1 text-xs text-gray-700">{review.comment ?? 'No comment provided.'}</p>
                    </div>
                    {review.admin_response && (
                        <div className="rounded-lg bg-[#488562]/5 px-4 py-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#488562]">Admin Response</div>
                            <p className="mt-1 text-xs text-gray-700">{review.admin_response}</p>
                            {review.resolved_at && (
                                <p className="mt-1 text-[10px] text-gray-400">Resolved {formatDate(review.resolved_at)}</p>
                            )}
                        </div>
                    )}
                    <div className="text-[10px] text-gray-400">Submitted {formatDate(review.created_at)}</div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3">
                    <button onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
                        Close
                    </button>
                    {(review.status === 'pending' || review.status === 'in_review') && (
                        <button onClick={() => onRespond(review)} className="rounded-lg bg-[#488562] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#3a7052]">
                            Respond
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function RespondModal({ review, onClose }: { review: Review; onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({
        admin_response: '',
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        post(`/admin/dashboard/feedback/${review.id}/respond`, {
            onSuccess: () => onClose(),
        });
    }

    function handleStatusUpdate(status: string) {
        router.patch(`/admin/dashboard/feedback/${review.id}/status`, { status }, {
            onSuccess: () => onClose(),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h3 className="text-sm font-bold text-gray-900">Respond to Review</h3>
                    <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
                    <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                        <StarRating rating={review.rating} />
                        <span className="text-[11px] text-gray-500">by {review.user.name}</span>
                    </div>
                    {review.comment && (
                        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">&ldquo;{review.comment}&rdquo;</p>
                    )}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Your Response</label>
                        <textarea
                            value={data.admin_response}
                            onChange={(e) => setData('admin_response', e.target.value)}
                            rows={4}
                            placeholder="Type your response to this customer..."
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                        {errors.admin_response && <p className="mt-1 text-[11px] text-red-500">{errors.admin_response}</p>}
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleStatusUpdate('in_review')} className="rounded-lg border border-[#0867ff]/20 bg-[#0867ff]/5 px-3 py-1.5 text-[11px] font-medium text-[#0867ff] hover:bg-[#0867ff]/10">
                                Mark In Review
                            </button>
                            <button type="button" onClick={() => handleStatusUpdate('dismissed')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50">
                                <ThumbsDown className="h-3 w-3" /> Dismiss
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" disabled={processing || !data.admin_response.trim()} className="rounded-lg bg-[#488562] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#3a7052] disabled:opacity-50">
                                {processing ? 'Submitting...' : 'Submit & Resolve'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
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
