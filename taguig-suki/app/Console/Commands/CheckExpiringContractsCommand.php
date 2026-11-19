<?php

namespace App\Console\Commands;

use App\Services\Admin\VendorContractService;
use Illuminate\Console\Command;

class CheckExpiringContractsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'contracts:check-expiring';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check vendor stall lease contracts for approaching expiration or expired status and send automatic vendor notifications';

    /**
     * Execute the console command.
     */
    public function handle(VendorContractService $contractService): int
    {
        $this->info('Checking stall lease contracts for expiration...');
        $result = $contractService->checkExpiringContracts();

        $this->info("Done! Flagged {$result['expiring_soon_count']} contract(s) as expiring soon and {$result['expired_count']} contract(s) as expired. Notifications sent.");

        return Command::SUCCESS;
    }
}
