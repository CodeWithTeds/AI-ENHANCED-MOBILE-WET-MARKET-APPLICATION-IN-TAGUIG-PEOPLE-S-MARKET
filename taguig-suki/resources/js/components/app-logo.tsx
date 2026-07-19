import { Leaf } from 'lucide-react';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white/15">
                <Leaf className="size-4 text-white" />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="truncate font-bold text-white">
                    TaguigSuki
                </span>
                <span className="truncate text-[10px] text-white/60">
                    Admin Panel
                </span>
            </div>
        </>
    );
}
