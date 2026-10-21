<?php

namespace Database\Seeders;

use App\Models\User;
use Database\Seeders\Concerns\BuildsSeedRows;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * The single admin account (users.id = 1), from ADMIN_EMAIL / ADMIN_PASSWORD (config/portfolio.php).
 *
 * The only seeder that overwrites on re-run: `php artisan db:seed --class=AdminUserSeeder` resets the
 * admin's email and password to the .env values (password-recovery path). Any other user, e.g. the old
 * account after ADMIN_EMAIL changed, is deleted together with its tokens.
 */
class AdminUserSeeder extends Seeder
{
    use BuildsSeedRows;

    private const ID = 1;

    public function run(): void
    {
        $email = (string) config('portfolio.admin.email');
        $password = (string) config('portfolio.admin.password');

        if ($email === '' || $password === '') {
            $this->command?->warn('ADMIN_EMAIL or ADMIN_PASSWORD is empty: admin user not seeded.');

            return;
        }

        $row = [
            'id' => self::ID,
            'name' => 'Admin',
            'email' => $email,
            'password' => Hash::make($password),
            ...$this->timestamps(),
        ];

        DB::transaction(function () use ($row): void {
            DB::table('personal_access_tokens')
                ->where('tokenable_type', (new User)->getMorphClass())
                ->where('tokenable_id', '!=', self::ID)
                ->delete();
            User::query()->whereKeyNot(self::ID)->delete();

            User::query()->upsert([$row], ['id'], $this->updatableColumns($row, ['id']));
        });
    }
}
