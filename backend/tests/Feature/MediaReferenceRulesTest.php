<?php

namespace Tests\Feature;

use App\Models\Award;
use App\Models\Experience;
use App\Models\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Every `*_media_id` must point at the kind the public site renders there:
 * images for avatar/portrait/og/logo/icon/award, a PDF for the CV.
 */
class MediaReferenceRulesTest extends TestCase
{
    use RefreshDatabase;

    private Media $image;

    private Media $pdf;

    private Media $video;

    protected function setUp(): void
    {
        parent::setUp();

        Http::fake();
        $this->actingAsAdmin();
        $this->image = Media::factory()->create();
        $this->pdf = Media::factory()->pdf()->create();
        $this->video = Media::factory()->create(['mime' => 'video/mp4', 'width' => null, 'height' => null]);
    }

    public function test_site_images_must_be_images_and_the_cv_a_pdf(): void
    {
        $site = fn (array $fields) => $this->putJson('/api/v1/admin/site', ['full_name' => 'Y', 'nickname' => 'H', ...$fields]);

        $site(['avatar_media_id' => $this->pdf->id])->assertUnprocessable()->assertJsonValidationErrors('avatar_media_id');
        $site(['portrait_media_id' => $this->video->id])->assertUnprocessable()->assertJsonValidationErrors('portrait_media_id');
        $site(['og_media_id' => $this->pdf->id])->assertUnprocessable()->assertJsonValidationErrors('og_media_id');
        $site(['cv_media_id' => $this->image->id])->assertUnprocessable()->assertJsonValidationErrors('cv_media_id');
        $site(['cv_media_id' => $this->video->id])->assertUnprocessable()->assertJsonValidationErrors('cv_media_id');

        $site([
            'avatar_media_id' => $this->image->id,
            'portrait_media_id' => $this->image->id,
            'og_media_id' => $this->image->id,
            'cv_media_id' => $this->pdf->id,
        ])->assertOk()->assertJsonPath('data.cv_media_id', $this->pdf->id);
    }

    public function test_award_and_experience_media_must_be_images(): void
    {
        $award = Award::factory()->create();
        $experience = Experience::factory()->create();

        $this->putJson('/api/v1/admin/awards/'.$award['id'], ['media_id' => $this->video->id])
            ->assertUnprocessable()->assertJsonValidationErrors('media_id');
        $this->putJson('/api/v1/admin/awards/'.$award['id'], ['media_id' => $this->image->id])->assertOk();

        $this->putJson('/api/v1/admin/experiences/'.$experience['id'], ['logo_media_id' => $this->pdf->id])
            ->assertUnprocessable()->assertJsonValidationErrors('logo_media_id');
        $this->putJson('/api/v1/admin/experiences/'.$experience['id'], ['logo_media_id' => $this->image->id])->assertOk();
    }
}
