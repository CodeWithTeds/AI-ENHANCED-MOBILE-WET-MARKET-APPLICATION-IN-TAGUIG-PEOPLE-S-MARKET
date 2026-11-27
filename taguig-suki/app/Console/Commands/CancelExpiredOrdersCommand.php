<?php

namespace App\Console\Commands;

use App\Services\OrderService;
use Illuminate\Console\Command;

class CancelExpiredOrdersCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'orders:cancel-expired';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automatically cancel unconfirmed pending orders whose 1-hour confirmation window has expired and restore stock';

    /**
     * Execute the console command.
     */
    public function handle(OrderService $orderService): int
    {
        $cancelledCount = $orderService->processExpiredOrders();

        $this->info("Processed expired orders. Auto-cancelled {$cancelledCount} order(s).");

        return Command::SUCCESS;
    }
}
