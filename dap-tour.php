<?php
/**
 * Plugin Name: DAP Tour
 * Description: A lightweight, portable onboarding tour engine — same JS engine used on other sites, wired into WordPress with an admin settings page and a REST analytics endpoint.
 * Version: 1.0.0
 * Author: Your Studio
 */

if (!defined('ABSPATH')) exit; // no direct access

define('DAP_TOUR_VERSION', '1.0.0');
define('DAP_TOUR_URL', plugin_dir_url(__FILE__));

/* -------------------------------------------------------------
   1. Enqueue the engine on the front end
------------------------------------------------------------- */
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('dap-engine', DAP_TOUR_URL . 'assets/dap-engine.css', [], DAP_TOUR_VERSION);
    wp_enqueue_script('dap-engine', DAP_TOUR_URL . 'assets/dap-engine.js', [], DAP_TOUR_VERSION, true);

    $steps = get_option('dap_tour_steps', '[]');
    $steps_decoded = json_decode($steps, true);
    if (!is_array($steps_decoded)) $steps_decoded = [];

    // Passes the wp-admin-edited config straight into DAP.init() —
    // same engine, same API as the standalone version, just fed by
    // WordPress options instead of a static tour-config.json file.
    wp_add_inline_script('dap-engine', '
        document.addEventListener("DOMContentLoaded", function () {
            DAP.init({
                config: ' . wp_json_encode($steps_decoded) . ',
                collectUrl: "' . esc_url_raw(rest_url('dap-tour/v1/collect')) . '",
                siteId: "' . esc_js(parse_url(home_url(), PHP_URL_HOST)) . '",
                tourId: "onboarding-v1"
            });
        });
    ');
});

/* -------------------------------------------------------------
   2. wp-admin settings page — non-technical editing of steps
------------------------------------------------------------- */
add_action('admin_menu', function () {
    add_options_page(
        'DAP Tour Steps',
        'DAP Tour',
        'manage_options',
        'dap-tour',
        'dap_tour_settings_page'
    );
    add_options_page(
        'DAP Tour Reports',
        'DAP Tour Reports',
        'manage_options',
        'dap-tour-reports',
        'dap_tour_reports_page'
    );
});

function dap_tour_reports_page() {
    global $wpdb;
    $table = $wpdb->prefix . 'dap_tour_events';

    $started   = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE event_type = 'tour_started'");
    $completed = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE event_type = 'tour_completed'");
    $rate = $started > 0 ? round(($completed / $started) * 100) : 0;

    $rows = $wpdb->get_results("
        SELECT step_index,
               SUM(event_type = 'step_viewed') AS viewed,
               SUM(event_type = 'step_completed') AS completed
        FROM $table
        WHERE step_index IS NOT NULL
        GROUP BY step_index
        ORDER BY step_index
    ");
    ?>
    <div class="wrap">
        <h1>DAP Tour — reports</h1>

        <div style="display:flex;gap:24px;margin:20px 0 30px;">
            <div style="background:#fff;border:1px solid #ccd0d4;border-radius:6px;padding:16px 22px;">
                <div style="font-size:12px;color:#646970;text-transform:uppercase;">Tours started</div>
                <div style="font-size:26px;font-weight:600;"><?php echo esc_html($started); ?></div>
            </div>
            <div style="background:#fff;border:1px solid #ccd0d4;border-radius:6px;padding:16px 22px;">
                <div style="font-size:12px;color:#646970;text-transform:uppercase;">Completion rate</div>
                <div style="font-size:26px;font-weight:600;"><?php echo esc_html($rate); ?>%</div>
            </div>
        </div>

        <h2>Drop-off by step</h2>
        <?php if (empty($rows)): ?>
            <p>No step data yet — this fills in once the tour has run a few times.</p>
        <?php else: ?>
            <table class="widefat striped" style="max-width:640px;">
                <thead><tr><th>Step</th><th>Viewed</th><th>Completed</th><th>Drop-off</th></tr></thead>
                <tbody>
                <?php foreach ($rows as $r):
                    $dropoff = $r->viewed > 0 ? round((1 - ($r->completed / $r->viewed)) * 100) : 0;
                ?>
                    <tr>
                        <td>Step <?php echo esc_html($r->step_index + 1); ?></td>
                        <td><?php echo esc_html($r->viewed); ?></td>
                        <td><?php echo esc_html($r->completed); ?></td>
                        <td><?php echo esc_html($dropoff); ?>%</td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    <?php
}

function dap_tour_settings_page() {
    if (isset($_POST['dap_tour_steps']) && check_admin_referer('dap_tour_save')) {
        $raw = wp_unslash($_POST['dap_tour_steps']);
        json_decode($raw); // validate before saving
        if (json_last_error() === JSON_ERROR_NONE) {
            update_option('dap_tour_steps', $raw);
            echo '<div class="notice notice-success"><p>Saved.</p></div>';
        } else {
            echo '<div class="notice notice-error"><p>That isn\'t valid JSON — nothing was saved.</p></div>';
        }
    }
    $steps = get_option('dap_tour_steps', dap_tour_default_steps());
    ?>
    <div class="wrap">
        <h1>DAP Tour — steps</h1>
        <p>Each step needs a CSS <code>selector</code> that matches an element on your page, a <code>title</code>, and a <code>body</code>. Ask your developer for the selector on any new element you want to spotlight.</p>
        <p>For form fields, add a <code>validate</code> rule (e.g. <code>{"type":"notEmpty"}</code> or <code>{"type":"pattern","value":"..."}</code>) and the step won't advance until the field is filled in correctly — useful for guiding someone through completing a form rather than just clicking through a feature tour.</p>
        <p>See <strong>Settings → DAP Tour Reports</strong> for completion rate and per-step drop-off.</p>
        <form method="post">
            <?php wp_nonce_field('dap_tour_save'); ?>
            <textarea name="dap_tour_steps" rows="16" style="width:100%;font-family:monospace;"><?php echo esc_textarea($steps); ?></textarea>
            <p><button class="button button-primary">Save steps</button></p>
        </form>
    </div>
    <?php
}

function dap_tour_default_steps() {
    return wp_json_encode([
        [
            "selector" => "#add-expense-btn",
            "title"    => "Log an expense",
            "body"     => "Add a new spend here — it drops straight into this month's report."
        ],
        [
            "selector" => "#filter-btn",
            "title"    => "Narrow the view",
            "body"     => "Filter by category, team member, or date range."
        ]
    ], JSON_PRETTY_PRINT);
}

/* -------------------------------------------------------------
   3. REST endpoint for analytics events
   Same event shape as the standalone engine
   (tour_started, step_viewed, step_completed, tour_completed,
   tour_abandoned) — just landed in a WP custom table instead
   of an external collector.
------------------------------------------------------------- */
add_action('rest_api_init', function () {
    register_rest_route('dap-tour/v1', '/collect', [
        'methods'  => 'POST',
        'callback' => 'dap_tour_collect_event',
        'permission_callback' => '__return_true', // public: this is anonymous usage telemetry, not authenticated data
    ]);
});

function dap_tour_collect_event(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'dap_tour_events';
    $body = $request->get_json_params();

    $wpdb->insert($table, [
        'event_type' => sanitize_text_field($body['type'] ?? ''),
        'site_id'    => sanitize_text_field($body['site_id'] ?? ''),
        'tour_id'    => sanitize_text_field($body['tour_id'] ?? ''),
        'step_index' => isset($body['step_index']) ? intval($body['step_index']) : null,
        'created_at' => current_time('mysql'),
    ]);

    return new WP_REST_Response(['ok' => true], 200);
}

/* -------------------------------------------------------------
   4. Create the events table on activation
------------------------------------------------------------- */
register_activation_hook(__FILE__, function () {
    global $wpdb;
    $table = $wpdb->prefix . 'dap_tour_events';
    $charset = $wpdb->get_charset_collate();

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta("CREATE TABLE $table (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_type VARCHAR(40) NOT NULL,
        site_id VARCHAR(190) NOT NULL,
        tour_id VARCHAR(190) NOT NULL,
        step_index INT NULL,
        created_at DATETIME NOT NULL,
        PRIMARY KEY (id)
    ) $charset;");
});
