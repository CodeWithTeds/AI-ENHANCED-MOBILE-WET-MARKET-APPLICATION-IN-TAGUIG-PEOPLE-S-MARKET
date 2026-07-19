import { Head, Link, usePage } from '@inertiajs/react';
import { dashboard, login } from '@/routes';
import {
    ArrowRight,
    ChefHat,
    Clock,
    Leaf,
    MapPin,
    ShieldCheck,
    ShoppingCart,
    Smartphone,
    Sparkles,
    Store,
    TrendingUp,
    Truck,
    Users,
} from 'lucide-react';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="TaguigSuki - AI-Enhanced Mobile Wet Market">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=inter:300,400,500,600,700,800&family=plus-jakarta-sans:400,500,600,700,800"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                {/* Navigation */}
                <nav className="fixed top-0 z-50 w-full bg-white/95 backdrop-blur-md shadow-sm">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 lg:px-8">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#488562]">
                                <Leaf className="h-5 w-5 text-white" />
                            </div>
                            <span
                                className="text-lg font-bold text-gray-900"
                                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                                TaguigSuki
                            </span>
                        </div>

                        <div className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
                            <a href="#features" className="transition-colors hover:text-[#488562]">Features</a>
                            <a href="#how-it-works" className="transition-colors hover:text-[#488562]">How It Works</a>
                            <a href="#about" className="transition-colors hover:text-[#488562]">About</a>
                        </div>

                        <div className="flex items-center gap-3">
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="inline-flex items-center gap-2 rounded-lg bg-[#488562] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3a6e50]"
                                >
                                    Dashboard
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            ) : (
                                <Link
                                    href={login()}
                                    className="inline-flex items-center gap-2 rounded-lg bg-[#488562] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3a6e50]"
                                >
                                    Admin Login
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Hero */}
                <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-24">
                    {/* Background */}
                    <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#f0f8f3] via-white to-white" />
                    <div className="absolute top-20 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-[#488562]/[0.04] blur-[80px]" />
                    <div className="absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-[#89baa3]/[0.06] blur-[60px]" />

                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                            <div className="max-w-xl">
                                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#488562]/20 bg-[#488562]/[0.06] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#488562]">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    AI-Powered Wet Market
                                </div>

                                <h1
                                    className="mb-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.25rem]"
                                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                                >
                                    Your Palengke,{' '}
                                    <span className="text-[#488562]">Smarter</span>{' '}
                                    &amp; Easier
                                </h1>

                                <p className="mb-8 text-base leading-relaxed text-gray-600 sm:text-lg">
                                    An AI-enhanced mobile application for Taguig People's Market.
                                    Browse recipes, auto-generate ingredient lists, find vendors,
                                    and order fresh produce — all from your phone.
                                </p>

                                <div className="flex flex-wrap items-center gap-4">
                                    <Link
                                        href={auth.user ? dashboard() : login()}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-[#488562] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#488562]/20 transition-all hover:bg-[#3a6e50] hover:shadow-xl"
                                    >
                                        {auth.user ? 'Open Dashboard' : 'Admin Portal'}
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                    </Link>
                                    <a
                                        href="#features"
                                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                                    >
                                        Learn More
                                    </a>
                                </div>

                                {/* Quick stats */}
                                <div className="mt-10 flex gap-8 border-t border-gray-100 pt-8">
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>50+</div>
                                        <div className="text-xs text-gray-500">Market Vendors</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>200+</div>
                                        <div className="text-xs text-gray-500">Recipes</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>1000+</div>
                                        <div className="text-xs text-gray-500">Fresh Products</div>
                                    </div>
                                </div>
                            </div>

                            {/* Hero visual — phone mockup card */}
                            <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
                                <div className="rounded-[2rem] border border-gray-200 bg-white p-3 shadow-2xl shadow-gray-200/60">
                                    <div className="rounded-[1.5rem] bg-gradient-to-b from-[#f0f8f3] to-white p-6">
                                        {/* Mock app header */}
                                        <div className="mb-4 flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-[#488562]" />
                                            <span className="text-xs font-semibold text-gray-700">Taguig People's Market</span>
                                        </div>

                                        {/* Recipe card */}
                                        <div className="mb-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-900">Sinigang na Baboy</span>
                                                <span className="rounded-full bg-[#ee600e]/10 px-2 py-0.5 text-[10px] font-semibold text-[#ee600e]">
                                                    AI Pick
                                                </span>
                                            </div>
                                            <div className="flex gap-3 text-[10px] text-gray-500">
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 45 min</span>
                                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> 4 servings</span>
                                                <span className="flex items-center gap-1">₱ 350</span>
                                            </div>
                                        </div>

                                        {/* Ingredients */}
                                        <div className="mb-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                                            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Ingredients</div>
                                            <div className="space-y-1.5">
                                                {['Pork ribs — Aling Rosa', 'Kangkong — Mang Tony', 'Tamarind — Aling Nena'].map((item, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-[11px] text-gray-600">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-[#488562]" />
                                                        {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* CTA button */}
                                        <button className="w-full rounded-lg bg-[#488562] py-2.5 text-xs font-semibold text-white">
                                            Add All to Cart — ₱ 350
                                        </button>
                                    </div>
                                </div>
                                {/* Floating badge */}
                                <div className="absolute -top-3 -right-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#488562] shadow-lg ring-1 ring-gray-100">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Smart Recipes
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="px-6 py-20 lg:px-8 lg:py-28">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-14 max-w-2xl">
                            <h2
                                className="mb-3 text-3xl font-bold text-gray-900"
                                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                                One app for the entire palengke experience
                            </h2>
                            <p className="text-base text-gray-500">
                                From AI-powered recipe picks to real-time vendor inventory — everything Taguig residents need for a better market day.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {features.map((f, i) => (
                                <div
                                    key={i}
                                    className="rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:shadow-md hover:shadow-gray-100"
                                >
                                    <div
                                        className="mb-3.5 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                                        style={{ backgroundColor: f.color + '10' }}
                                    >
                                        <f.icon className="h-5 w-5" style={{ color: f.color }} />
                                    </div>
                                    <h3 className="mb-1.5 text-sm font-bold text-gray-900">{f.title}</h3>
                                    <p className="text-sm leading-relaxed text-gray-500">{f.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section id="how-it-works" className="border-t border-gray-100 bg-[#fafcfb] px-6 py-20 lg:px-8 lg:py-28">
                    <div className="mx-auto max-w-5xl">
                        <div className="mb-14 text-center">
                            <h2
                                className="mb-3 text-3xl font-bold text-gray-900"
                                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                                How TaguigSuki works
                            </h2>
                            <p className="mx-auto max-w-lg text-base text-gray-500">
                                A simple, smart flow from recipe to fresh ingredients at your door.
                            </p>
                        </div>

                        <div className="grid gap-8 md:grid-cols-4">
                            {steps.map((step, i) => (
                                <div key={i} className="relative text-center">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#488562]/[0.08]">
                                        <step.icon className="h-6 w-6 text-[#488562]" />
                                    </div>
                                    <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[#488562]">
                                        Step {i + 1}
                                    </div>
                                    <h3 className="mb-1 text-sm font-bold text-gray-900">{step.title}</h3>
                                    <p className="text-xs leading-relaxed text-gray-500">{step.description}</p>
                                    {i < steps.length - 1 && (
                                        <div className="absolute top-7 -right-4 hidden text-gray-200 md:block">
                                            <ArrowRight className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* About / Mission */}
                <section id="about" className="border-t border-gray-100 px-6 py-20 lg:px-8 lg:py-28">
                    <div className="mx-auto max-w-4xl text-center">
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#0867ff]/[0.06] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#0867ff]">
                            <Smartphone className="h-3.5 w-3.5" />
                            Capstone Project
                        </div>
                        <h2
                            className="mb-4 text-3xl font-bold text-gray-900"
                            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                            Modernizing the Palengke
                        </h2>
                        <p className="mx-auto mb-6 max-w-2xl text-base leading-relaxed text-gray-600">
                            TaguigSuki is an AI-Enhanced Mobile Wet Market Application developed for
                            Taguig People's Market. It transforms the traditional palengke experience by
                            combining AI-based recipe recommendations, automated ingredient lists,
                            real-time vendor inventory, and mobile ordering into one platform —
                            making market trips faster, smarter, and more convenient for every Juan.
                        </p>
                        <p className="text-sm text-gray-400">
                            A capstone project by BSIT students — Binuya, Clapis, Estonillo, Indonilla &amp; Larioza (May 2026)
                        </p>
                    </div>
                </section>

                {/* CTA Banner */}
                <section className="mx-6 mb-16 overflow-hidden rounded-3xl bg-[#488562] px-8 py-14 lg:mx-8 lg:px-16">
                    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                        <h2
                            className="mb-3 text-2xl font-bold text-white sm:text-3xl"
                            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                            Ready to manage the marketplace?
                        </h2>
                        <p className="mb-7 max-w-md text-sm text-white/80">
                            Access the admin dashboard to monitor vendors, products, orders, and AI recommendations.
                        </p>
                        <Link
                            href={auth.user ? dashboard() : login()}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#488562] shadow-lg transition hover:bg-gray-50"
                        >
                            {auth.user ? 'Go to Dashboard' : 'Admin Sign In'}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-gray-100 px-6 py-8 lg:px-8">
                    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#488562]">
                                <Leaf className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                TaguigSuki
                            </span>
                        </div>
                        <p className="text-xs text-gray-400">
                            © {new Date().getFullYear()} TaguigSuki • AI-Enhanced Mobile Wet Market Application • Taguig People's Market
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
}

const features = [
    {
        title: 'AI Recipe Suggestions',
        description: 'Get personalized recipe recommendations based on your preferences and available ingredients at the market.',
        icon: Sparkles,
        color: '#ee600e',
    },
    {
        title: 'Auto Ingredient Lists',
        description: 'Select a recipe and the app generates a complete ingredient list matched to vendors who have them in stock.',
        icon: ChefHat,
        color: '#488562',
    },
    {
        title: 'Vendor Directory',
        description: 'Browse all vendors at Taguig People\u2019s Market with real-time product availability and pricing.',
        icon: Store,
        color: '#0867ff',
    },
    {
        title: 'Mobile Ordering',
        description: 'Order from multiple vendors in one transaction. Skip the lines and pick up when ready.',
        icon: ShoppingCart,
        color: '#488562',
    },
    {
        title: 'Live Inventory',
        description: 'Vendors update stock in real time so you always know what\u2019s fresh and available before visiting.',
        icon: TrendingUp,
        color: '#ee600e',
    },
    {
        title: 'Secure & Private',
        description: 'Built with data privacy in mind — secure authentication, encrypted data, and role-based access.',
        icon: ShieldCheck,
        color: '#0867ff',
    },
];

const steps = [
    {
        title: 'Pick a Recipe',
        description: 'Choose from AI-recommended dishes or search your favorites.',
        icon: ChefHat,
    },
    {
        title: 'Get Ingredients',
        description: 'Auto-generated list matched to available market products.',
        icon: Leaf,
    },
    {
        title: 'Choose Vendors',
        description: 'Select preferred vendors based on price and availability.',
        icon: Store,
    },
    {
        title: 'Order & Pickup',
        description: 'Place your order and pick up fresh produce at the market.',
        icon: Truck,
    },
];
