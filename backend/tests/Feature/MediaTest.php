<?php

namespace Tests\Feature;

use App\Models\Award;
use App\Models\Experience;
use App\Models\Media;
use App\Models\Project;
use App\Models\SiteSetting;
use App\Models\Skill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Intervention\Image\ImageManager;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class MediaTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/media';

    private const ADMIN_SHAPE = [
        'id', 'url', 'thumb_url', 'mime', 'width', 'height', 'alt', 'blur_data_url', 'dominant_color',
        'has_original', 'original_name', 'size', 'created_at', 'updated_at',
    ];

    /** @var array<int, string> */
    private array $tempFiles = [];

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
    }

    protected function tearDown(): void
    {
        array_map(fn (string $path) => @unlink($path), $this->tempFiles);

        parent::tearDown();
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->postJson(self::URL)->assertUnauthorized();
        $this->getJson(self::URL.'/1')->assertUnauthorized();
        $this->patchJson(self::URL.'/1', ['alt' => 'x'])->assertUnauthorized();
        $this->postJson(self::URL.'/1/replace')->assertUnauthorized();
        $this->deleteJson(self::URL.'/1')->assertUnauthorized();
    }

    public function test_the_media_disks_come_from_config_for_object_storage_in_production(): void
    {
        config(['portfolio.media.disk' => 's3', 'portfolio.media.originals_disk' => 's3-private']);
        $served = Storage::fake('s3');
        $originals = Storage::fake('s3-private');
        $this->actingAsAdmin();

        $data = $this->upload([UploadedFile::fake()->image('photo.jpg', 800, 600)])
            ->assertCreated()
            ->json('data.0');

        $row = Media::query()->findOrFail($data['id'])->toArray();
        $this->assertSame('s3', $row['disk']);
        $served->assertExists([$row['path'], $row['thumb_path']]);
        $originals->assertExists($row['original_path']);
        $this->assertSame($served->url($row['path']), $data['url']);
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame([], Storage::disk('local')->allFiles());

        $this->deleteJson(self::URL.'/'.$data['id'])->assertOk();
        $served->assertMissing([$row['path'], $row['thumb_path']]);
        $originals->assertMissing($row['original_path']);
    }

    public function test_a_jpeg_becomes_a_webp_with_thumb_blur_and_colour_and_the_original_stays_private(): void
    {
        $this->actingAsAdmin();

        $response = $this->upload([UploadedFile::fake()->image('photo.jpg', 2400, 1600)], ['alt' => 'A photo'])
            ->assertCreated()
            ->assertJsonStructure(['data' => [self::ADMIN_SHAPE]])
            ->assertJsonPath('data.0.mime', 'image/webp')
            ->assertJsonPath('data.0.width', 1920)
            ->assertJsonPath('data.0.height', 1280)
            ->assertJsonPath('data.0.alt', 'A photo')
            ->assertJsonPath('data.0.has_original', true)
            ->assertJsonPath('data.0.original_name', 'photo.jpg')
            ->assertJsonMissingPath('data.0.used_in')
            ->assertJsonMissingPath('data.0.original_path');

        $data = $response->json('data.0');
        $this->assertStringStartsWith('data:image/webp;base64,', $data['blur_data_url']);
        $this->assertLessThan(1024, strlen($data['blur_data_url']));
        $this->assertMatchesRegularExpression('/^#[0-9a-f]{6}$/', $data['dominant_color']);

        $row = Media::query()->findOrFail($data['id'])->toArray();
        $this->assertMatchesRegularExpression('#^media/\d{4}/\d{2}/[0-9a-f-]{36}\.webp$#', $row['path']);
        $this->assertSame(substr($row['path'], 0, -5).'-thumb.webp', $row['thumb_path']);
        $this->assertSame(substr($row['path'], 0, -5).'.jpg', $row['original_path']);
        $this->assertStringEndsWith($row['path'], $data['url']);
        $this->assertStringEndsWith($row['thumb_path'], $data['thumb_url']);

        $public = Storage::disk('public');
        $served = getimagesizefromstring($public->get($row['path']));
        $this->assertSame([1920, 1280, 'image/webp'], [$served[0], $served[1], $served['mime']]);
        $this->assertSame(strlen($public->get($row['path'])), $data['size']);
        $thumb = getimagesizefromstring($public->get($row['thumb_path']));
        $this->assertSame([480, 320, 'image/webp'], [$thumb[0], $thumb[1], $thumb['mime']]);

        // The untouched upload lives on the private disk only.
        Storage::disk('local')->assertExists($row['original_path']);
        $public->assertMissing($row['original_path']);
        $this->assertCount(2, $public->allFiles());
    }

    public function test_exif_orientation_is_applied_and_exif_is_stripped_from_served_files(): void
    {
        $this->actingAsAdmin();

        $jpeg = $this->jpegWithOrientation(400, 200, 6); // 6 = rotate 90° clockwise

        $data = $this->upload([UploadedFile::fake()->createWithContent('rotated.jpg', $jpeg)])
            ->assertCreated()
            ->assertJsonPath('data.0.width', 200)
            ->assertJsonPath('data.0.height', 400)
            ->json('data.0');

        $row = Media::query()->findOrFail($data['id'])->toArray();
        $this->assertStringNotContainsString('Exif', Storage::disk('public')->get($row['path']));
        $this->assertStringNotContainsString('Exif', Storage::disk('public')->get($row['thumb_path']));
        $this->assertStringContainsString('Exif', Storage::disk('local')->get($row['original_path']));
    }

    public function test_a_png_is_converted_without_upscaling_and_its_colour_is_computed(): void
    {
        $this->actingAsAdmin();

        $data = $this->upload([UploadedFile::fake()->createWithContent('logo.png', $this->solidPng(300, 200, [61, 90, 254]))])
            ->assertCreated()
            ->assertJsonPath('data.0.mime', 'image/webp')
            ->assertJsonPath('data.0.width', 300)
            ->assertJsonPath('data.0.height', 200)
            ->assertJsonPath('data.0.dominant_color', '#3d5afe')
            ->json('data.0');

        $this->assertNotNull($data['thumb_url']);
        $this->assertStringEndsWith('.png', Media::query()->findOrFail($data['id'])->toArray()['original_path']);
    }

    public function test_a_gif_is_kept_as_is_with_a_thumb_from_its_first_frame(): void
    {
        $this->actingAsAdmin();

        $manager = ImageManager::gd();
        $gif = (string) $manager->animate(function ($animation) use ($manager) {
            $animation->add($manager->create(60, 40)->fill('ff0000'), 0.2);
            $animation->add($manager->create(60, 40)->fill('0000ff'), 0.2);
        })->toGif();

        $data = $this->upload([UploadedFile::fake()->createWithContent('anim.gif', $gif)])
            ->assertCreated()
            ->assertJsonPath('data.0.mime', 'image/gif')
            ->assertJsonPath('data.0.width', 60)
            ->assertJsonPath('data.0.height', 40)
            ->assertJsonPath('data.0.has_original', false)
            ->json('data.0');

        // First frame (red), not the second (blue); the GIF palette shifts the exact value slightly.
        [$red, $green, $blue] = sscanf($data['dominant_color'], '#%02x%02x%02x');
        $this->assertGreaterThan(200, $red);
        $this->assertLessThan(40, $green);
        $this->assertLessThan(40, $blue);

        $row = Media::query()->findOrFail($data['id'])->toArray();
        $this->assertStringEndsWith('.gif', $row['path']);
        $this->assertSame($gif, Storage::disk('public')->get($row['path']), 'animation must be stored untouched');
        $this->assertSame('image/webp', getimagesizefromstring(Storage::disk('public')->get($row['thumb_path']))['mime']);
        $this->assertStringStartsWith('data:image/webp;base64,', $data['blur_data_url']);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_pdf_and_video_are_stored_as_is_without_previews(): void
    {
        $this->actingAsAdmin();

        $response = $this->upload([
            UploadedFile::fake()->createWithContent('cv.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
            UploadedFile::fake()->create('clip.mp4', 2048, 'video/mp4'),
        ])->assertCreated()->assertJsonCount(2, 'data');

        foreach ([0 => 'application/pdf', 1 => 'video/mp4'] as $index => $mime) {
            $response->assertJsonPath("data.{$index}.mime", $mime)
                ->assertJsonPath("data.{$index}.thumb_url", null)
                ->assertJsonPath("data.{$index}.width", null)
                ->assertJsonPath("data.{$index}.height", null)
                ->assertJsonPath("data.{$index}.blur_data_url", null)
                ->assertJsonPath("data.{$index}.dominant_color", null)
                ->assertJsonPath("data.{$index}.has_original", false);
        }

        $response->assertJsonPath('data.0.original_name', 'cv.pdf')
            ->assertJsonPath('data.1.size', 2048 * 1024);

        $paths = array_column(Media::query()->orderBy('id')->get(['path'])->toArray(), 'path');
        $this->assertStringEndsWith('.pdf', $paths[0]);
        $this->assertStringEndsWith('.mp4', $paths[1]);
        Storage::disk('public')->assertExists($paths);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_several_files_are_stored_in_upload_order(): void
    {
        $this->actingAsAdmin();

        $this->upload([
            UploadedFile::fake()->image('one.jpg', 50, 50),
            UploadedFile::fake()->image('two.png', 50, 50),
            UploadedFile::fake()->image('three.webp', 50, 50),
        ])->assertCreated()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.original_name', 'one.jpg')
            ->assertJsonPath('data.1.original_name', 'two.png')
            ->assertJsonPath('data.2.original_name', 'three.webp');

        $this->assertSame(3, Media::query()->count());
    }

    public function test_svg_is_rejected(): void
    {
        $this->actingAsAdmin();

        $svg = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

        $this->upload([UploadedFile::fake()->createWithContent('logo.svg', $svg)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('files.0');

        // Renaming it does not help: the real mime is read from the content.
        $this->upload([$this->realUpload('logo.png', $svg)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('files.0');

        $this->assertNothingStored();
    }

    public function test_an_extension_that_does_not_match_the_content_is_rejected(): void
    {
        $this->actingAsAdmin();

        $this->upload([$this->realUpload('photo.jpg', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF")])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['files.0' => 'does not match its content']);

        $this->upload([$this->realUpload('photo.jpg', $this->solidPng(20, 20, [0, 0, 0]))])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['files.0' => 'does not match its content']);

        $this->upload([UploadedFile::fake()->create('notes.txt', 1, 'text/plain')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('files.0');

        $this->assertNothingStored();
    }

    /**
     * @return array<string, array{string, int, string}>
     */
    public static function oversizedFiles(): array
    {
        return [
            'image over 8 MB' => ['huge.jpg', 8 * 1024 + 1, 'image/jpeg'],
            'pdf over 10 MB' => ['huge.pdf', 10 * 1024 + 1, 'application/pdf'],
            'video over 30 MB' => ['huge.mp4', 30 * 1024 + 1, 'video/mp4'],
        ];
    }

    #[DataProvider('oversizedFiles')]
    public function test_files_over_their_size_limit_are_rejected(string $name, int $kilobytes, string $mime): void
    {
        $this->actingAsAdmin();

        $this->upload([UploadedFile::fake()->create($name, $kilobytes, $mime)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('files.0');

        $this->assertNothingStored();
    }

    public function test_a_pdf_under_its_limit_may_be_larger_than_the_image_limit(): void
    {
        $this->actingAsAdmin();

        $this->upload([UploadedFile::fake()->create('big.pdf', 9 * 1024, 'application/pdf')])->assertCreated();
    }

    public function test_the_file_count_is_limited(): void
    {
        $this->actingAsAdmin();

        $this->upload([])->assertUnprocessable()->assertJsonValidationErrors('files');

        $files = array_map(fn (int $i) => UploadedFile::fake()->create("doc{$i}.pdf", 1, 'application/pdf'), range(1, 21));
        $this->upload($files)->assertUnprocessable()->assertJsonValidationErrors('files');

        $this->assertNothingStored();
    }

    public function test_a_file_that_cannot_be_processed_rolls_back_the_whole_upload(): void
    {
        $this->actingAsAdmin();

        $this->upload([
            UploadedFile::fake()->image('good.jpg', 100, 100),
            UploadedFile::fake()->createWithContent('broken.jpg', 'definitely not a jpeg'),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['files.1' => 'broken.jpg could not be processed']);

        $this->assertNothingStored();
    }

    public function test_alt_can_be_updated(): void
    {
        $this->actingAsAdmin();
        $media = Media::factory()->create(['alt' => 'Old']);

        $this->patchJson(self::URL."/{$media['id']}", ['alt' => 'Dashboard screenshot'])
            ->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_SHAPE])
            ->assertJsonPath('data.id', $media['id'])
            ->assertJsonPath('data.alt', 'Dashboard screenshot');

        $this->assertSame('Dashboard screenshot', Media::query()->findOrFail($media['id'])->toArray()['alt']);

        $this->patchJson(self::URL."/{$media['id']}", ['alt' => null])->assertOk()->assertJsonPath('data.alt', null);
        $this->patchJson(self::URL."/{$media['id']}", [])->assertUnprocessable()->assertJsonValidationErrors('alt');
        $this->patchJson(self::URL."/{$media['id']}", ['alt' => str_repeat('a', 256)])->assertUnprocessable();
        $this->patchJson(self::URL.'/999', ['alt' => 'x'])->assertNotFound()->assertExactJson(['message' => 'Not found.']);
    }

    public function test_replace_keeps_the_id_and_removes_the_old_files(): void
    {
        $this->actingAsAdmin();

        $id = $this->upload([UploadedFile::fake()->image('old.jpg', 800, 600)], ['alt' => 'Keep me'])->json('data.0.id');
        $old = Media::query()->findOrFail($id)->toArray();

        $this->post(self::URL."/{$id}/replace", ['file' => UploadedFile::fake()->image('new.png', 640, 480)], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_SHAPE])
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.original_name', 'new.png')
            ->assertJsonPath('data.width', 640)
            ->assertJsonPath('data.alt', 'Keep me');

        $new = Media::query()->findOrFail($id)->toArray();
        $this->assertNotSame($old['path'], $new['path']);
        Storage::disk('public')->assertMissing([$old['path'], $old['thumb_path']]);
        Storage::disk('local')->assertMissing($old['original_path']);
        Storage::disk('public')->assertExists([$new['path'], $new['thumb_path']]);
        Storage::disk('local')->assertExists($new['original_path']);
        $this->assertSame(1, Media::query()->count());
    }

    public function test_replace_must_keep_the_media_kind(): void
    {
        $this->actingAsAdmin();

        $id = $this->upload([UploadedFile::fake()->image('cover.jpg', 100, 100)])->json('data.0.id');
        Project::factory()->create(['slug' => 'ocr', 'cover_media_id' => $id]);
        $before = Storage::disk('public')->allFiles();

        $this->post(self::URL."/{$id}/replace", ['file' => UploadedFile::fake()->create('cv.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file' => 'The new file must be an image, like the one it replaces.']);

        $this->assertSame($before, Storage::disk('public')->allFiles());
        $this->getJson('/api/v1/public/projects/ocr')->assertOk()->assertJsonPath('data.cover.mime', 'image/webp');
    }

    public function test_a_pdf_can_be_replaced_with_another_pdf(): void
    {
        $this->actingAsAdmin();

        $id = $this->upload([UploadedFile::fake()->create('cv-2025.pdf', 10, 'application/pdf')])->json('data.0.id');

        $this->post(self::URL."/{$id}/replace", ['file' => UploadedFile::fake()->create('cv-2026.pdf', 12, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.mime', 'application/pdf')
            ->assertJsonPath('data.original_name', 'cv-2026.pdf')
            ->assertJsonPath('data.thumb_url', null)
            ->assertJsonPath('data.has_original', false);

        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertCount(1, Storage::disk('public')->allFiles());
        $this->post(self::URL."/{$id}/replace", ['file' => UploadedFile::fake()->image('photo.jpg', 10, 10)], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file' => 'The new file must be a PDF, like the one it replaces.']);
    }

    public function test_images_over_the_pixel_limit_are_rejected_before_decoding(): void
    {
        $this->actingAsAdmin();
        config(['portfolio.media.max_pixels' => 10_000]);

        $this->upload([UploadedFile::fake()->image('ok.jpg', 100, 100), UploadedFile::fake()->image('huge.png', 200, 100)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['files.1' => 'huge.png is 200×100 px; images may have at most 0.01 megapixels.'])
            ->assertJsonMissingValidationErrors('files.0');

        $this->assertNothingStored();
    }

    public function test_replace_validates_the_file(): void
    {
        $this->actingAsAdmin();
        $media = Media::factory()->create();

        $this->post(self::URL."/{$media['id']}/replace", [], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->post(self::URL."/{$media['id']}/replace", ['file' => UploadedFile::fake()->create('a.svg', 1, 'image/svg+xml')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->post(self::URL.'/999/replace', ['file' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])
            ->assertNotFound();
    }

    public function test_destroy_is_blocked_while_the_media_is_a_project_cover(): void
    {
        $this->actingAsAdmin();
        $media = Media::factory()->create();
        $project = Project::factory()->create(['title' => 'Mindlens', 'cover_media_id' => $media['id']]);

        $this->deleteJson(self::URL."/{$media['id']}")
            ->assertConflict()
            ->assertExactJson([
                'message' => 'Media is in use.',
                'used_in' => [['type' => 'project', 'id' => $project['id'], 'label' => 'Mindlens', 'field' => 'cover']],
            ]);

        $this->assertDatabaseHas('media', ['id' => $media['id']]);
    }

    public function test_destroy_is_blocked_while_the_media_is_in_a_project_gallery(): void
    {
        $this->actingAsAdmin();
        $media = Media::factory()->create();
        $project = Project::factory()->create(['title' => 'Radioactive 2025']);
        $project->gallery()->attach($media['id'], ['device' => 'mobile', 'sort_order' => 0]);

        $this->deleteJson(self::URL."/{$media['id']}")
            ->assertConflict()
            ->assertJsonPath('message', 'Media is in use.')
            ->assertJsonPath('used_in', [
                ['type' => 'project', 'id' => $project['id'], 'label' => 'Radioactive 2025', 'field' => 'gallery'],
            ]);

        $this->assertDatabaseHas('media', ['id' => $media['id']]);
    }

    public function test_destroy_removes_the_row_and_every_file(): void
    {
        $this->actingAsAdmin();

        $id = $this->upload([UploadedFile::fake()->image('bye.jpg', 300, 200)])->json('data.0.id');
        $this->assertCount(2, Storage::disk('public')->allFiles());
        $this->assertCount(1, Storage::disk('local')->allFiles());

        $this->deleteJson(self::URL."/{$id}")->assertOk()->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseMissing('media', ['id' => $id]);
        $this->assertNothingStored();
        $this->deleteJson(self::URL."/{$id}")->assertNotFound();
    }

    public function test_show_lists_every_reference(): void
    {
        $this->actingAsAdmin();
        $media = Media::factory()->create();
        $id = $media['id'];

        $site = SiteSetting::factory()->create(['avatar_media_id' => $id, 'cv_media_id' => $id]);
        $project = Project::factory()->create(['title' => 'OCR', 'og_media_id' => $id, 'boss_media_id' => $id]);
        $project->gallery()->attach($id, ['device' => 'desktop', 'sort_order' => 0]);
        $experience = Experience::factory()->create(['title' => 'Software Developer Intern', 'logo_media_id' => $id]);
        $skill = Skill::factory()->create(['name' => 'Laravel', 'icon_media_id' => $id]);
        $award = Award::factory()->create(['title' => 'Gold Medal', 'media_id' => $id]);
        Project::factory()->create(['cover_media_id' => Media::factory()->create()['id']]); // someone else's

        $this->getJson(self::URL."/{$id}")
            ->assertOk()
            ->assertJsonStructure(['data' => [...self::ADMIN_SHAPE, 'used_in']])
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.used_in', [
                ['type' => 'site', 'id' => $site['id'], 'label' => 'Site settings', 'field' => 'avatar'],
                ['type' => 'site', 'id' => $site['id'], 'label' => 'Site settings', 'field' => 'cv'],
                ['type' => 'project', 'id' => $project['id'], 'label' => 'OCR', 'field' => 'boss'],
                ['type' => 'project', 'id' => $project['id'], 'label' => 'OCR', 'field' => 'og'],
                ['type' => 'project', 'id' => $project['id'], 'label' => 'OCR', 'field' => 'gallery'],
                ['type' => 'experience', 'id' => $experience['id'], 'label' => 'Software Developer Intern', 'field' => 'logo'],
                ['type' => 'skill', 'id' => $skill['id'], 'label' => 'Laravel', 'field' => 'icon'],
                ['type' => 'award', 'id' => $award['id'], 'label' => 'Gold Medal', 'field' => 'media'],
            ]);

        $this->getJson(self::URL.'/999')->assertNotFound();
    }

    public function test_index_paginates_newest_first(): void
    {
        $this->actingAsAdmin();

        foreach (range(1, 30) as $i) {
            Media::factory()->create(['created_at' => now()->subMinutes(100 - $i)]);
        }
        $newest = Media::factory()->create(['created_at' => now()]);

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(24, 'data')
            ->assertJsonPath('data.0.id', $newest['id'])
            ->assertJsonPath('data.0.used_in', [])
            ->assertExactJsonStructure([
                'data' => ['*' => [...self::ADMIN_SHAPE, 'used_in']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ])
            ->assertJsonPath('meta', ['current_page' => 1, 'last_page' => 2, 'per_page' => 24, 'total' => 31]);

        $this->getJson(self::URL.'?per_page=10&page=4')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta', ['current_page' => 4, 'last_page' => 4, 'per_page' => 10, 'total' => 31]);

        $this->getJson(self::URL.'?per_page=101')->assertUnprocessable()->assertJsonValidationErrors('per_page');
        $this->getJson(self::URL.'?type=svg')->assertUnprocessable()->assertJsonValidationErrors('type');
    }

    public function test_index_filters_by_search_and_type(): void
    {
        $this->actingAsAdmin();

        $image = Media::factory()->create(['original_name' => 'mindlens-home.jpg', 'alt' => 'Landing page']);
        $byAlt = Media::factory()->create(['original_name' => 'shot-2.jpg', 'alt' => 'Mindlens dashboard']);
        $pdf = Media::factory()->pdf()->create(['original_name' => 'cv.pdf', 'alt' => null]);
        $video = Media::factory()->create([
            'original_name' => 'demo.mp4', 'mime' => 'video/mp4', 'path' => 'media/2026/10/demo.mp4',
            'thumb_path' => null, 'original_path' => null, 'width' => null, 'height' => null,
        ]);

        $ids = fn (TestResponse $response) => array_column($response->assertOk()->json('data'), 'id');

        $this->assertEqualsCanonicalizing([$image['id'], $byAlt['id']], $ids($this->getJson(self::URL.'?q=MINDLENS')));
        $this->assertSame([$pdf['id']], $ids($this->getJson(self::URL.'?type=pdf')));
        $this->assertSame([$video['id']], $ids($this->getJson(self::URL.'?type=video')));
        $this->assertEqualsCanonicalizing([$image['id'], $byAlt['id']], $ids($this->getJson(self::URL.'?type=image')));
        $this->assertSame([$byAlt['id']], $ids($this->getJson(self::URL.'?type=image&q=dashboard')));
        $this->assertSame([], $ids($this->getJson(self::URL.'?q=nothing-matches')));
    }

    public function test_index_usage_lookup_does_not_grow_with_the_page(): void
    {
        $this->actingAsAdmin();

        $countQueries = function (): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->getJson(self::URL)->assertOk();
            DB::disableQueryLog();

            return count(DB::getQueryLog());
        };

        $this->referencedMedia(2);
        $few = $countQueries();

        $this->referencedMedia(10);
        $many = $countQueries();

        $this->assertSame($few, $many);

        $response = $this->getJson(self::URL)->assertOk();
        foreach ($response->json('data') as $row) {
            $this->assertCount(2, $row['used_in']);
        }
    }

    /**
     * @param  array<int, UploadedFile>  $files
     * @param  array<string, mixed>  $extra
     */
    private function upload(array $files, array $extra = []): TestResponse
    {
        return $this->post(self::URL, ['files' => $files] + $extra, ['Accept' => 'application/json']);
    }

    private function assertNothingStored(): void
    {
        $this->assertSame(0, Media::query()->count());
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    /** Each media is a project cover and a skill icon. */
    private function referencedMedia(int $count): void
    {
        for ($n = 0; $n < $count; $n++) {
            $media = Media::factory()->create();
            Project::factory()->create(['cover_media_id' => $media['id']]);
            Skill::factory()->create(['icon_media_id' => $media['id']]);
        }
    }

    /** A real (non-fake) upload: its mime type is detected from the content, as in production. */
    private function realUpload(string $name, string $content): UploadedFile
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'media-test-');
        file_put_contents($path, $content);
        $this->tempFiles[] = $path;

        return new UploadedFile($path, $name, null, null, true);
    }

    /**
     * @param  array{int, int, int}  $rgb
     */
    private function solidPng(int $width, int $height, array $rgb): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, ...$rgb));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    /** A JPEG with a minimal EXIF block that only carries IFD0 Orientation. */
    private function jpegWithOrientation(int $width, int $height, int $orientation): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefilledrectangle($image, 0, 0, (int) ($width / 2), $height, imagecolorallocate($image, 255, 75, 43));
        ob_start();
        imagejpeg($image, null, 90);
        $jpeg = (string) ob_get_clean();

        $tiff = 'II'.pack('vV', 42, 8)          // little-endian TIFF header, IFD0 at offset 8
            .pack('v', 1)                       // one entry
            .pack('vvVvv', 0x0112, 3, 1, $orientation, 0) // Orientation, SHORT, count 1, value
            .pack('V', 0);                      // no next IFD
        $app1 = "Exif\0\0".$tiff;

        return substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($app1) + 2).$app1.substr($jpeg, 2);
    }
}
